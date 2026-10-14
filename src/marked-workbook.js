const ExcelJS = require('exceljs');
const { overview } = require('./overview');
function markedWorkbook(vesselSheet, selection, quayRows, quayColumn) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Marked loading list');
  const statuses = new Map(overview(vesselSheet, selection, quayRows, quayColumn).loadingRows.map(row => [row.sourceRow, row.status]));
  const width = vesselSheet.rows.reduce((max, row) => Math.max(max, row.length), 0);
  vesselSheet.rows.forEach((values, index) => {
    const row = sheet.addRow(values);
    if (index === selection.start - 2) { row.getCell(width + 1).value = 'Terminal status'; row.font = { bold: true }; }
    if (index < selection.start - 1 || !values.some(value => String(value).trim())) return;
    const status = statuses.get(index + 1);
    if (!status) return;
    row.getCell(width + 1).value = status;
    const color = status === 'Delivered' ? 'FFDDF1E4' : status === 'Outstanding' ? 'FFFFEDD3' : 'FFE8EBEF';
    for (let col = 1; col <= width + 1; col++) row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  });
  sheet.columns.forEach(column => { column.width = 18; });
  sheet.getColumn(selection.column + 1).width = 22;
  sheet.getColumn(width + 1).width = 23;
  sheet.views = [{ state: 'frozen', ySplit: selection.start - 1 }];
  return workbook;
}
module.exports = { markedWorkbook };
