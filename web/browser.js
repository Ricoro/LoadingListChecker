const XLS = require('@e965/xlsx');
const { parse } = require('csv-parse/browser/esm/sync');
const { compare } = require('../src/compare');
const { overview } = require('../src/overview');
const { suggestSelection } = require('../src/selection');
const { markedWorkbook } = require('../src/marked-workbook');
const imports = new Map();
function chooseFile() {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.xls,.xlsx,.csv'; input.hidden = true;
    const finish = file => { input.remove(); resolve(file); };
    input.addEventListener('change', () => finish(input.files[0] || null), { once: true });
    input.addEventListener('cancel', () => finish(null), { once: true });
    document.body.append(input); input.click();
  });
}
async function readBrowserFile(file) {
  if (file.size > 25 * 1024 * 1024) throw new Error('Please choose a file smaller than 25 MB.');
  if (/\.csv$/i.test(file.name)) {
    const text = await file.text();
    const attempts = [',', ';', '\t'].map(delimiter => {
      try { return parse(text, { delimiter, bom: true, skip_empty_lines: true, relax_column_count: true }); } catch { return null; }
    }).filter(Boolean);
    if (!attempts.length) throw new Error('Could not read CSV. Check its quoting and encoding.');
    attempts.sort((a,b) => (b[0]?.length || 0) - (a[0]?.length || 0));
    return [{ name: 'CSV', rows: attempts[0] }];
  }
  if (!/\.xlsx?$/i.test(file.name)) throw new Error('Choose an Excel .xls, .xlsx or CSV file.');
  const workbook = XLS.read(await file.arrayBuffer(), { type: 'array' });
  return workbook.SheetNames.map(name => ({ name, rows: XLS.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '', blankrows: true, range: 0, raw: false }) }));
}
function selected(selections, side) {
  const selection = selections?.[side], sheet = imports.get(side)?.[selection?.sheet];
  if (!sheet || !Number.isInteger(selection.column) || selection.column < 0 || !Number.isInteger(selection.start) || selection.start < 1) throw new Error('Import both lists and choose their columns and first data rows.');
  return { sheet, selection, rows: sheet.rows.slice(selection.start - 1), column: selection.column };
}
window.checker = {
  async import(side) {
    if (!['vessel', 'quay'].includes(side)) throw new Error('Invalid list.');
    const file = await chooseFile();
    if (!file) return null;
    const name = file.name, sheets = await readBrowserFile(file);
    imports.set(side, sheets);
    return { name, sheets: sheets.map(sheet => ({ name: sheet.name, count: sheet.rows.length, suggested: suggestSelection(sheet.rows, side), preview: sheet.rows.slice(0, 20), columns: sheet.rows.reduce((width, row) => Math.max(width, row.length), 0) })) };
  },
  async compare(selections) {
    const v = selected(selections, 'vessel'), q = selected(selections, 'quay');
    return { ...compare(v.rows, v.column, q.rows, q.column), ...overview(v.sheet, v.selection, q.rows, q.column) };
  },
  async exportMarked(selections) {
    const v = selected(selections, 'vessel'), q = selected(selections, 'quay');
    const buffer = await markedWorkbook(v.sheet, v.selection, q.rows, q.column).xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const link = document.createElement('a'); link.href = url; link.download = 'marked-loading-list.xlsx';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  }
};
require('../src/renderer');
