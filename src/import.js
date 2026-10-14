const ExcelJS = require('exceljs');
const { parse } = require('csv-parse/sync');
const fs = require('node:fs/promises');
const path = require('node:path');
const XLS = require('@e965/xlsx');
function cellText(value) {
  if (value == null) return '';
  if (typeof value !== 'object') return String(value);
  if ('result' in value) return cellText(value.result);
  if (value.richText) return value.richText.map(part => part.text).join('');
  if (value.text) return String(value.text);
  return '';
}
async function readList(file) {
  const extension = path.extname(file).toLowerCase();
  if (extension === '.csv') {
    const text = await fs.readFile(file, 'utf8');
    const attempts = [',', ';', '\t'].map(delimiter => {
      try { return parse(text, { delimiter, bom: true, skip_empty_lines: true, relax_column_count: true }); } catch { return null; }
    }).filter(Boolean);
    if (!attempts.length) throw new Error('Could not read CSV. Check its quoting and encoding.');
    attempts.sort((a,b) => (b[0]?.length || 0) - (a[0]?.length || 0));
    return [{ name: 'CSV', rows: attempts[0] }];
  }
  if (extension === '.xls') {
    const workbook = XLS.read(await fs.readFile(file), { type: 'buffer' });
    return workbook.SheetNames.map(name => ({ name, rows: XLS.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '', blankrows: true, range: 0, raw: false }) }));
  }
  if (extension !== '.xlsx') throw new Error('Choose an Excel .xls, .xlsx or CSV file.');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  return workbook.worksheets.map(sheet => {
    const rows = [];
    sheet.eachRow({ includeEmpty: true }, row => {
      rows.push(Array.from({ length: sheet.columnCount }, (_, i) => cellText(row.getCell(i + 1).value)));
    });
    return { name: sheet.name, rows };
  });
}
const { suggestSelection, suggestBlockedColumn } = require('./selection');
module.exports = { readList, suggestSelection, suggestBlockedColumn };
