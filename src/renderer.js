const state = { vessel: null, quay: null, result: null };
const $ = id => document.getElementById(id);
function element(tag, text) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; return el; }
function invalidate() { state.result = null; $('results').hidden = true; $('compare').disabled = !(state.vessel && state.quay); $('message').textContent = ''; }
function selections() {
  return Object.fromEntries(['vessel','quay'].map(side => [side, { sheet: Number($(side+'-sheet').value), column: Number($(side+'-column').value), start: Number($(side+'-start').value) }]));
}
function configure(side) {
  const data = state[side], host = $(side).querySelector('.configuration');
  host.replaceChildren(); host.hidden = false;
  host.append(element('div', data.name)); host.firstChild.className = 'filename';
  const sheetLabel = element('label', 'Worksheet'); const sheets = element('select'); sheets.id = side+'-sheet';
  data.sheets.forEach((s,i) => { const option = element('option', `${s.name} (${s.count} rows)`); option.value = i; sheets.append(option); });
  sheetLabel.append(sheets); host.append(sheetLabel);
  const columnLabel = element('label','Container-number column'); const columns = element('select'); columns.id = side+'-column'; columnLabel.append(columns); host.append(columnLabel);
  const startLabel = element('label','First data row'); const start = element('input'); start.type = 'number'; start.min = '1'; start.value = '2'; start.id = side+'-start'; startLabel.append(start); host.append(startLabel);
  const preview = element('div'); preview.className = 'preview'; host.append(preview);
  function populate() {
    const sheet = data.sheets[Number(sheets.value)]; columns.replaceChildren();
    const first = sheet.preview[0] || [];
    for (let i=0;i<sheet.columns;i++) { const option = element('option', `Column ${i+1}${first[i] ? ' — '+first[i] : ''}`); option.value = i; columns.append(option); }
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
  $('rows').replaceChildren(); selected.slice(0,2000).forEach(r => { const tr = element('tr'); tr.className = r.status.toLowerCase().replace(/ /g,'-'); tr.append(element('td',String(r.sourceRow ?? '')),element('td',r.container || 'Not assigned'),element('td',`${r.size || ''} ${r.type || ''}`.trim()),element('td',r.booking || ''));  const td = element('td'), badge = element('span',r.status); badge.className = 'badge'+(r.status==='Delivered' ? ' delivered' : ''); td.append(badge); tr.append(td); $('rows').append(tr); });
  $('shown').textContent = `${selected.length} loading-list rows${selected.length>2000 ? ' · Showing the first 2,000; marked Excel includes the full loading list.' : ''}`;
}
$('compare').addEventListener('click', async () => {
  $('compare').disabled = true; $('message').textContent = '';
  try {
    const result = await window.checker.compare(selections()); state.result = result;
    if (!result.vessel.containers) { $('message').textContent = 'No valid container numbers found in one of the lists. Check the worksheet, column and first data row.'; return; }
    $('vesselName').textContent = result.vesselName || 'Vessel loading list';
    $('total').textContent = result.results.length; const delivered = result.results.filter(r=>r.status==='Delivered').length;
    $('delivered').textContent = delivered; $('outstanding').textContent = result.results.length-delivered;
    $('quality').textContent = ['vessel','quay'].map(side=>`${side === 'vessel' ? 'Vessel' : 'Quay'}: ${result[side].duplicates} duplicate rows, ${result[side].invalid} invalid values and ${result[side].blank} blank cells excluded`).join(' · ')+`. ${result.missingNumbers || 0} booking rows have no usable container number and are shown as Cannot match. Container format: 4 letters + 7 digits; check digits are not verified.`;
    $('quayOnly').textContent = `${result.quayOnly.length} quay containers are outside this vessel list and excluded from the results.`;
    $('filter').value = 'all'; $('search').value = ''; $('results').hidden = false; renderRows();
  } catch(error) { $('message').textContent = error.message; }
  finally { $('compare').disabled = false; }
});
$('filter').addEventListener('change',renderRows); $('search').addEventListener('input',renderRows);
$('export').addEventListener('click',async () => { try { if(await window.checker.export(selections())) $('message').textContent = 'Results exported successfully.'; } catch(error) { $('message').textContent = error.message; } });

$('export-marked').addEventListener('click',async () => { try { if(await window.checker.exportMarked(selections())) $('message').textContent = 'Marked loading list saved. Original file unchanged.'; } catch(error) { $('message').textContent = error.message; } });
