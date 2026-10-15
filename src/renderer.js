const state = { vessel: null, quay: null, result: null };
const $ = id => document.getElementById(id);
function element(tag, text) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; return el; }
function invalidate() { window.checker.invalidate?.(); document.dispatchEvent(new Event('comparison-invalidated')); state.result = null; $('results').hidden = true; $('compare').disabled = !(state.vessel && state.quay); $('message').textContent = ''; }
function selections() {
  return Object.fromEntries(['vessel','quay'].map(side => [side, { sheet: Number($(side+'-sheet')?.value), column: Number($(side+'-column')?.value), start: Number($(side+'-start')?.value), ...(side === 'quay' ? { blockedColumn: Number($('quay-blocked')?.value) } : {}) }]));
}
function configure(side) {
  const data = state[side], container = $(side).querySelector('.configuration');
  container.replaceChildren(); container.hidden = false;
  const filename = element('div', data.name); filename.className = 'filename'; container.append(filename);
  const details = element('details'); details.className = 'import-settings'; details.append(element('summary', 'Worksheet settings and preview'));
  const host = element('div'); details.append(host); container.append(details);
  host.replaceChildren(); host.hidden = false;
  const sheetLabel = element('label', 'Worksheet'); const sheets = element('select'); sheets.id = side+'-sheet';
  data.sheets.forEach((s,i) => { const option = element('option', `${s.name} (${s.count} rows)`); option.value = i; sheets.append(option); });
  sheetLabel.append(sheets); host.append(sheetLabel);
  const columnLabel = element('label','Container-number column'); const columns = element('select'); columns.id = side+'-column'; columnLabel.append(columns); host.append(columnLabel);
  let blocked;
  if (side === 'quay') { const label = element('label', 'Blocked column'); blocked = element('select'); blocked.id = 'quay-blocked'; label.append(blocked); host.append(label); blocked.addEventListener('change', invalidate); }
  const startLabel = element('label','First data row'); const start = element('input'); start.type = 'number'; start.min = '1'; start.value = '2'; start.id = side+'-start'; startLabel.append(start); host.append(startLabel);
  const preview = element('div'); preview.className = 'preview'; host.append(preview);
  function populate() {
    const sheet = data.sheets[Number(sheets.value)]; columns.replaceChildren();
    const first = sheet.preview[0] || [];
    for (let i=0;i<sheet.columns;i++) { const option = element('option', `Column ${i+1}${first[i] ? ' — '+first[i] : ''}`); option.value = i; columns.append(option); }
    if (blocked) { blocked.replaceChildren(); const none = element('option', 'No blocked column'); none.value = '-1'; blocked.append(none); for (let i=0;i<sheet.columns;i++) { const option = element('option', `Column ${i+1}${first[i] ? ' — '+first[i] : ''}`); option.value = i; blocked.append(option); } blocked.value = String(sheet.suggestedBlockedColumn ?? -1); }
    const guessed = first.findIndex(v => /container|cntr|unit\s*(no|number)/i.test(String(v)));
    columns.value = String(sheet.suggested?.column ?? Math.max(0,guessed));
    start.value = first.some(v => /^[A-Za-z]{4}[\s-]*\d{7}$/.test(String(v).trim())) ? '1' : '2';
    if (sheet.suggested) start.value = String(sheet.suggested.start);
    preview.replaceChildren(); const table = element('table');
    sheet.preview.slice(0,5).forEach((row,index) => { const tr = element('tr'); tr.append(element('td',String(index+1))); row.forEach(value => tr.append(element('td',value))); table.append(tr); }); preview.append(table);
    invalidate();
  }
  sheets.addEventListener('change',populate); columns.addEventListener('change',invalidate); start.addEventListener('input',invalidate); populate();
}
document.querySelectorAll('.import').forEach(button => button.addEventListener('click', async () => {
  button.disabled = true; $('message').textContent = '';
  try { const side = button.dataset.side; const data = await window.checker.import(side); if(data) { state[side] = data; configure(side); } }
  catch(error) { $('message').textContent = error.message; }
  finally { button.disabled = false; }
}));
function renderRows() {
  const selected = (state.result.loadingRows || state.result.results).filter(r => ($('filter').value === 'all' || r.status === $('filter').value) && r.container.includes($('search').value.toUpperCase().replace(/[\s-]/g,'')));
  $('rows').replaceChildren(); selected.slice(0,2000).forEach(r => { const tr = element('tr'); tr.className = r.status.toLowerCase().replace(/ /g,'-'); tr.append(element('td',String(r.sourceRow ?? '')),element('td',r.container || 'Not assigned'),element('td',`${r.size || ''} ${r.type || ''}`.trim()),element('td',r.booking || ''));  const td = element('td'), badge = element('span',r.status); badge.className = 'badge'+(r.status==='Delivered' ? ' delivered' : r.status==='Blocked' ? ' blocked' : ''); td.append(badge); tr.append(td); $('rows').append(tr); });
  $('shown').textContent = `${selected.length} loading-list rows${selected.length>2000 ? ' · Showing the first 2,000; Excel keeps each container/booking combination and all bookings awaiting numbers.' : ''}`;
}
function showResult(result) { state.result = result;
    if (!(result.countedBookingRows ?? result.vessel.containers)) { $('message').textContent = 'No valid container numbers found in one of the lists. Check the worksheet, column and first data row.'; return; }
    const conflicts = result.bookingConflicts || [];
    $('booking-warning').textContent = conflicts.length ? `Check bookings: ${conflicts.slice(0,5).map(item => item.container + ' (' + item.bookings.map(booking => booking || 'no booking number').join(', ') + ')').join('; ')}${conflicts.length > 5 ? '; and '+(conflicts.length-5)+' more' : ''}. These container numbers appear under different bookings; their rows are kept in Excel.` : '';
    $('vesselName').textContent = result.vesselName || 'Vessel loading list';
    $('total').textContent = result.bookedTotal ?? result.results.length;
    $('received').textContent = result.numberedContainers ?? result.results.length;
    $('awaiting').textContent = (result.bookedTotal ?? result.results.length) - (result.numberedContainers ?? result.results.length);
    $('booked-teu').textContent = result.bookedTeu ?? 'Unavailable';
    $('terminal-teu').textContent = result.terminalTeu ?? 'Unavailable';
    $('teu-warning').textContent = result.bookedTeu == null || result.terminalTeu == null ? 'TEU total unavailable: check the container sizes or the loading-list TEU total. 20 ft = 1 TEU; 40/45 ft = 2 TEU.' : '';
     const delivered = result.results.filter(r=>r.status==='Delivered' || r.status==='Blocked').length;
    $('blocked').textContent = result.blockedCount ?? result.results.filter(r=>r.status==='Blocked').length;
    $('delivered').textContent = delivered;
    $('quality').textContent = 'Awaiting container numbers = total booked containers − container numbers received. Repeated container numbers count once. On terminal includes blocked containers. The overview keeps all bill-of-lading rows; Excel removes repeats within the same booking and keeps bookings awaiting numbers.';
    $('quayOnly').textContent = `${(result.quayOnlyCount ?? result.quayOnly.length)} terminal containers are outside this vessel list and excluded from the results.`;
    $('filter').value = 'all'; $('search').value = ''; $('results').hidden = false; renderRows();
}
window.checker.showResult = showResult;
$('compare').addEventListener('click', async () => {
  $('compare').disabled = true; $('message').textContent = '';
  try {
    const result = await window.checker.compare(selections()); state.result = result;
    showResult(result);
    document.dispatchEvent(new Event('comparison-complete'));
  } catch(error) { $('message').textContent = error.message; }
  finally { $('compare').disabled = false; }
});
$('filter').addEventListener('change',renderRows); $('search').addEventListener('input',renderRows);


$('export-marked').addEventListener('click',async () => { try { if(await window.checker.exportMarked(selections())) $('message').textContent = 'Marked loading list saved. Original file unchanged.'; } catch(error) { $('message').textContent = error.message; } });

if (window.checker.updates) {
  const api = window.checker.updates;
  let updateState;
  function renderUpdate(state) {
    if (!state) return;
    updateState = state;
    $('update-settings').hidden = state.phase === 'disabled';
    $('update-current').textContent = `Installed version: ${state.version}`;
    $('update-settings-message').textContent = state.message;
    $('update-check').disabled = ['checking','downloading','ready'].includes(state.phase);
    const labels = { available: [`Update ${state.latestVersion} available`,'Download update'], downloading: ['Downloading update',null], ready: ['Update ready','Restart and update'], error: ['Update unavailable','Retry'] };
    const label = labels[state.phase];
    $('update-banner').hidden = !label;
    if (!label) return;
    $('update-title').textContent = label[0];
    $('update-message').textContent = state.message;
    $('update-action').hidden = !label[1];
    $('update-action').textContent = label[1] || '';
    $('update-progress').hidden = state.phase !== 'downloading';
    $('update-progress').value = state.progress || 0;
  }
  async function action(operation) {
    try { const state = await operation(); if (state && typeof state === 'object') renderUpdate(state); }
    catch { $('update-settings').open = true; $('update-settings-message').textContent = 'Could not complete this action. Check your internet connection and try again.'; }
  }
  api.onState(renderUpdate);
  api.get().then(renderUpdate).catch(() => {});
  $('update-later').addEventListener('click', () => { $('update-banner').hidden = true; });
  $('update-action').addEventListener('click', () => {
    if (updateState?.phase === 'available') action(() => api.download());
    else if (updateState?.phase === 'ready') action(() => api.install());
    else action(() => api.check());
  });
  $('update-check').addEventListener('click', () => action(() => api.check()));
}

if (window.checker.emailMarked) $('email-marked').addEventListener('click', async () => { const button = $('email-marked'); button.disabled = true; try { if (await window.checker.emailMarked(selections())) $('message').textContent = 'Mail draft downloaded with the marked Excel attached. Open it in Outlook, add recipients and send. If it opens in reading mode, choose Forward.'; } catch (error) { $('message').textContent = error.message; } finally { button.disabled = false; } });
