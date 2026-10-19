const fs = require('node:fs/promises');
const path = require('node:path');
const esbuild = require('esbuild');
async function build() {
  const output = path.resolve('dist/web');
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output, { recursive: true });
  const testing = process.env.PORTAL_ENVIRONMENT === 'testing';
  const config = {enabled:!testing && process.env.SHAREPOINT_HISTORY_ENABLED === 'true',tenantId:process.env.M365_TENANT_ID || '',clientId:process.env.M365_CLIENT_ID || '',siteUrl:process.env.SHAREPOINT_SITE_URL || 'https://seabownv.sharepoint.com/sites/seabow',folder:process.env.SHAREPOINT_HISTORY_FOLDER || 'LoadingListCheckerExcels',driveId:process.env.SHAREPOINT_DRIVE_ID || ''};
  for (const id of [config.tenantId, config.clientId]) if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('Microsoft tenant/client IDs must be GUIDs.');
  const site = new URL(config.siteUrl);
  if (!/^[a-z0-9-]+\.sharepoint\.com$/i.test(site.hostname) || site.protocol !== 'https:') throw new Error('Invalid SharePoint site');
  const result = await esbuild.build({ define:{SHARED_HISTORY_CONFIG:JSON.stringify(config)}, entryPoints: ['web/browser.js'], bundle: true, minify: true, platform: 'browser', target: ['chrome110', 'edge110', 'firefox115'], outdir: output, entryNames: 'portal-[hash]', metafile: true, legalComments: 'linked' });
  const script = Object.entries(result.metafile.outputs).find(([, item]) => item.entryPoint)?.[0];
  let html = await fs.readFile('src/index.html', 'utf8');
  html = html.replace('default-src \'self\'; script-src \'self\'; style-src \'self\'', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src https://graph.microsoft.com https://login.microsoftonline.com https://*.sharepoint.com https://*.files.1drv.com; frame-src 'self' https://login.microsoftonline.com; object-src 'none'; base-uri 'none'");
  if (testing) {
    html = html.replace('<title>Loading List Checker</title>', '<title>Testing · Loading List Checker</title>').replace('</head>', '<meta name="robots" content="noindex,nofollow"></head>').replace('<body>', '<body><aside id="testing-banner" role="note">TESTING ENVIRONMENT · Changes here are for review. The standard app stays on the approved version.</aside>');
  }
  html = html.replace('</header>', '<section class="portal-intro"><p>Use this page independently on any PC with a modern browser. Files are compared in your browser. Your files stay on this computer. Use Save as Excel or Mail to keep or share the results.</p></section></header>');
  html = html.replace('<button id="export-marked">Save as Excel</button>', '<button id="export-marked">Save as Excel</button><button id="email-marked" title="Download an Outlook email draft with the marked Excel attached">Mail</button>');
  html = html.replace('<main>', '<main><section id="shared-history" class="portal-intro" hidden></section>');
  html = html.replace('<script src="renderer.js"></script>', `<script src="${path.basename(script)}"></script>`);
  await fs.writeFile(path.join(output, 'index.html'), html);
  await fs.copyFile('src/theme.js', path.join(output, 'theme.js'));
  await fs.cp('src/assets', path.join(output, 'assets'), {recursive:true});
  await fs.writeFile(path.join(output, 'style.css'), (await fs.readFile('src/style.css', 'utf8')) + '\n#testing-banner{padding:14px 24px;background:#fff1cf;color:#704b00;border-bottom:2px solid #d9a441;font-weight:600;text-align:center}\n.portal-intro{margin-top:22px;padding:16px 20px;background:#edf4f6;border:1px solid #d3e2e8;border-radius:10px}.portal-intro p{margin:0 0 12px}\n');
  await fs.writeFile(path.join(output, 'auth.html'), '<!doctype html><html><head><meta charset="utf-8"><title>Microsoft sign-in</title></head><body></body></html>');
  await fs.writeFile(path.join(output, '.nojekyll'), '');
  console.log('Browser portal built in dist/web.');
}
build().catch(error => { console.error(error); process.exitCode = 1; });
