const { validateRecord, decodeBytes } = require('./history-record');
const GRAPH = 'https://graph.microsoft.com/v1.0';
class SharePointStore {
  constructor({ config, auth, fetcher = fetch }) {
    this.config = config; this.auth = auth; this.fetcher = fetcher;
    const url = new URL(config.siteUrl);
    if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.sharepoint\.com$/i.test(url.hostname) || url.username || url.password || url.search || url.hash) throw new Error('Configure the SharePoint site URL, without a document link or query string.');
    this.site = url;
    this.parts = (config.folder || 'Loading List Checker/History').split('/').filter(Boolean);
    if (!this.parts.length || this.parts.some(part=>part==='.' || part==='..' || /[\x00-\x1f:#?]/.test(part))) throw new Error('The SharePoint history folder is invalid.');
  }
  async request(resource, options = {}) {
    const url = resource.startsWith('https:') ? new URL(resource) : new URL(GRAPH + resource);
    if (url.origin !== 'https://graph.microsoft.com' || !url.pathname.startsWith('/v1.0/')) throw new Error('Unexpected SharePoint API address.');
    const token = await this.auth.token();
    const response = await this.fetcher(url.href, { ...options, credentials:'omit', headers:{ 'Content-Type':'application/json', ...options.headers, Authorization:`Bearer ${token}` } });
    if (!response.ok) {
      const error = new Error(response.status === 403 ? 'Your work account or app does not have access to the SharePoint history folder. Ask your site administrator.' : response.status === 401 ? 'Please sign in again to access shared comparisons.' : response.status === 429 ? 'SharePoint is busy. Wait a moment and refresh the history.' : 'Could not access SharePoint. Check your connection and retry.');
      error.status = response.status; throw error;
    }
    return response.json();
  }
  async drive() {
    if (this.driveId) return this.driveId;
    if (this.config.driveId) { this.driveId = this.config.driveId; return this.driveId; }
    const site = await this.request(`/sites/${this.site.hostname}:${this.site.pathname.replace(/\/$/,'')}?$select=id`);
    const drive = await this.request(`/sites/${encodeURIComponent(site.id)}/drive?$select=id`);
    this.driveId = drive.id; return drive.id;
  }
  rootPath(drive, parts = this.parts) { return `/drives/${encodeURIComponent(drive)}/root:/${parts.map(encodeURIComponent).join('/')}`; }
  async folder(create = false) {
    const drive = await this.drive();
    try {
      const folder = await this.request(`${this.rootPath(drive)}?$select=id,folder`);
      if (!folder.folder) throw new Error('The configured history location is not a folder.');
      return folder.id;
    } catch (error) { if (error.status !== 404) throw error; if (!create) return null; }
    let parent = 'root';
    for (let i=0; i<this.parts.length; i++) {
      let folder;
      try { folder = await this.request(`${this.rootPath(drive,this.parts.slice(0,i+1))}?$select=id,folder`); }
      catch (error) {
        if (error.status !== 404) throw error;
        try { folder = await this.request(`/drives/${encodeURIComponent(drive)}/${parent==='root'?'root':`items/${encodeURIComponent(parent)}`}/children`, { method:'POST', body:JSON.stringify({ name:this.parts[i],folder:{},'@microsoft.graph.conflictBehavior':'fail' }) }); }
        catch (creationError) { if (creationError.status !== 409) throw creationError; folder = await this.request(`${this.rootPath(drive,this.parts.slice(0,i+1))}?$select=id,folder`); }
      }
      if (!folder.folder) throw new Error('The configured history location is not a folder.');
      parent = folder.id;
    }
    return parent;
  }
  async list() {
    const drive = await this.drive(), folder = await this.folder();
    if (!folder) return [];
    const rows = []; let resource = `/drives/${encodeURIComponent(drive)}/items/${encodeURIComponent(folder)}/children?$select=id,name,createdDateTime,createdBy,file,size&$top=200`;
    while (resource) {
      const page = await this.request(resource);
      for (const item of page.value || []) {
        if (item.file && /^comparison-[0-9a-f-]{36}\.json$/i.test(item.name) && Number.isFinite(Date.parse(item.createdDateTime))) rows.push({ id:item.id, name:item.name, timestamp:item.createdDateTime, author:item.createdBy?.user?.displayName || 'Colleague' });
      }
      resource = page['@odata.nextLink'];
    }
    return rows.sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp));
  }
  async save(record) {
    validateRecord(record);
    const body = JSON.stringify(record);
    if (new TextEncoder().encode(body).length > 20 * 1024 * 1024) throw new Error('This comparison is too large for shared history (20 MB limit). You can still save it as Excel.');
    const drive = await this.drive(); await this.folder(true);
    await this.request(`${this.rootPath(drive)}/comparison-${record.id}.xlsx:/content`, {method:'PUT',body:decodeBytes(record.excelBase64),headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}});
    const item = await this.request(`${this.rootPath(drive)}/comparison-${record.id}.json:/content`, { method:'PUT',body });
    if (!item.id || !Number.isFinite(Date.parse(item.createdDateTime))) throw new Error('SharePoint did not return a timestamp for this comparison. Refresh the history before retrying.');
    return { id:item.id,timestamp:item.createdDateTime,author:item.createdBy?.user?.displayName || 'Colleague' };
  }
  async load(id) {
    const drive = await this.drive(), folder = await this.folder();
    const item = await this.request(`/drives/${encodeURIComponent(drive)}/items/${encodeURIComponent(id)}?$select=id,name,parentReference,size,@microsoft.graph.downloadUrl`);
    if (item.parentReference?.id !== folder || !/^comparison-[0-9a-f-]{36}\.json$/i.test(item.name) || item.size > 20*1024*1024) throw new Error('This item is not a saved comparison in the history folder.');
    const url = new URL(item['@microsoft.graph.downloadUrl']);
    if (url.protocol !== 'https:' || url.username || url.password || !(url.hostname.endsWith('.sharepoint.com') || url.hostname.endsWith('.files.1drv.com'))) throw new Error('SharePoint returned an unexpected download address.');
    // Graph's /content redirect cannot be used with browser CORS preflight.
    // Fetch its short-lived download URL without forwarding an access token.
    const response = await this.fetcher(url.href, { credentials:'omit' });
    if (!response.ok) throw new Error('Could not download this saved comparison. Refresh the history and try again.');
    return validateRecord(JSON.parse(await response.text()));
  }
}
module.exports = { SharePointStore };
