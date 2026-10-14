const { MicrosoftAuth } = require('./microsoft-auth');
const { SharePointStore } = require('./sharepoint-store');
const { displayTimestamp } = require('./history-record');
function setupHistory({config,snapshot,open}) {
  const host=document.getElementById('shared-history');
  if (!config.enabled || !config.tenantId || !config.clientId) return;
  host.hidden=false;
  const title=document.createElement('h2');title.textContent='Previous comparisons';host.append(title);
  const message=document.createElement('p'), list=document.createElement('div');host.append(message);
  if (!config.tenantId || !config.clientId) {message.textContent='Shared history needs one-time Microsoft 365 setup by your IT team. Comparisons currently stay on this PC until you download them.';return;}
  document.querySelector('.local').textContent='Private SharePoint history';
  const auth=new MicrosoftAuth(config),store=new SharePointStore({config,auth});
  let account, pending, revision=0;
  function button(label,action) {const b=document.createElement('button');b.textContent=label;b.addEventListener('click',async()=>{b.disabled=true;try{await action();}catch(e){message.textContent=e.message;}finally{b.disabled=false;}});host.append(b);return b;}
  const sign=button('Sign in with work account',async()=>{account=await auth.signIn();update();await refresh();if(pending)await save();});
  const out=button('Sign out',async()=>{await auth.signOut();account=null;pending=null;revision++;window.checker.invalidate();list.replaceChildren();document.getElementById('results').hidden=true;update();});
  const reload=button('Refresh',refresh),retry=button('Save current comparison',save);host.append(list);
  function update(){sign.hidden=!!account;out.hidden=!account;reload.hidden=!account;retry.hidden=!account||!pending;message.textContent=account?'Signed in as '+account.username+'. Comparisons and marked Excel files are saved to SharePoint.':'Sign in to save and share comparisons with colleagues.';}
  async function refresh(){const items=await store.list();list.replaceChildren();if(!items.length){const p=document.createElement('p');p.textContent='No saved comparisons yet.';list.append(p);}for(const item of items){const row=document.createElement('p'),b=document.createElement('button');b.textContent='Open';row.textContent=displayTimestamp(item.timestamp)+' · '+item.author+' ';b.addEventListener('click',async()=>{b.disabled=true;try{const record=await store.load(item.id);open(record);message.textContent='Viewing comparison from '+displayTimestamp(item.timestamp)+' · '+(record.result.vesselName||'Vessel')+'. Sources: '+Object.values(record.sources||{}).join(', ');pending=null;retry.hidden=true;}catch(e){message.textContent=e.message;}finally{b.disabled=false;}});row.append(b);list.append(row);}}
  async function save(){if(!pending||!account)return;const recordPromise=pending,version=revision;retry.disabled=true;message.textContent='Saving comparison to SharePoint…';try{const item=await store.save(await recordPromise);if(version===revision){pending=null;retry.hidden=true;message.textContent='Saved to SharePoint · '+displayTimestamp(item.timestamp);}await refresh();}catch(e){if(version===revision)message.textContent='Comparison has not been saved. '+e.message;throw e;}finally{retry.disabled=false;}}
  document.addEventListener('comparison-invalidated',()=>{revision++;pending=null;retry.hidden=true;});
  document.addEventListener('comparison-complete',()=>{revision++;pending=snapshot();pending.catch(()=>{});retry.hidden=!account;if(account)save().catch(()=>{});else message.textContent='Comparison has not been shared. Sign in to save it to SharePoint.';});
  update();auth.restore().then(a=>{account=a;update();if(account)return refresh();}).catch(e=>{message.textContent=e.message;});
}
module.exports={setupHistory};
