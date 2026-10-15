const ExcelJS = require('exceljs');
const { overview } = require('./overview');
const { normalize } = require('./compare');
const excludedHeaders = new Set(['sealno', 'pol', 'pod', 'blno', 'status', 'weight', 'tare', 'imo', 'oceanvessel', 'oceancarrier', 'oceanblno', 'stock', 'consignee', 'forwarder', 'forwardervatno', 'skkkfk']);
const normalizeHeader = value => String(value ?? '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]/g, '');
function markedWorkbook(vesselSheet, selection, quayRows, quayColumn, blockedColumn = 4) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Marked loading list');
  const statuses = new Map(overview(vesselSheet, selection, quayRows, quayColumn, blockedColumn).loadingRows.map(row => [row.sourceRow, row.status]));
  const sourceWidth = vesselSheet.rows.reduce((max, row) => Math.max(max, row.length), 0);
  const headers = vesselSheet.rows[selection.start - 2] || [];
  const keptColumns = Array.from({ length: sourceWidth }, (_, index) => index).filter(index => {
    const header = normalizeHeader(headers[index]);
    return !excludedHeaders.has(header) && header !== 'terminalstatus';
  });
  const width = keptColumns.length;
  const headersBooking = headers.findIndex(value => /^booking/i.test(String(value).trim()));
  const exportedBookings = new Map();
  vesselSheet.rows.forEach((values, index) => {
    const status = statuses.get(index + 1);
    if (status && status !== 'No containernumber') {
      const container = normalize(values[selection.column]);
      const booking = String(values[headersBooking] ?? '').trim().toUpperCase();
      const bookings = exportedBookings.get(container) || new Set();
      if (bookings.has(booking)) return;
      bookings.add(booking); exportedBookings.set(container, bookings);
    }
    const row = sheet.addRow(keptColumns.map(column => values[column] ?? ''));
    if (index === selection.start - 2) { row.getCell(width + 1).value = 'Terminal status'; row.font = { bold: true }; }
    if (index < selection.start - 1 || !values.some(value => String(value).trim())) return;
    if (!status) return;
    row.getCell(width + 1).value = status;
    if (status === 'Blocked') row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    const color = status === 'Blocked' ? 'FF8B1E2D' : status === 'Delivered' ? 'FFDDF1E4' : status === 'Outstanding' ? 'FFFFEDD3' : 'FFE8EBEF';
    for (let col = 1; col <= width + 1; col++) row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  });
  sheet.columns.forEach(column => { column.width = 18; column.alignment = { horizontal: 'left' }; });
  const grossColumn = keptColumns.findIndex(column => normalizeHeader(headers[column]) === 'gross') + 1;
  if (grossColumn > 0) {
    const column = sheet.getColumn(grossColumn);
    let length = 18;
    column.eachCell(cell => { length = Math.max(length, String(cell.value ?? '').length + 2); });
    column.width = length;
    column.alignment = { horizontal: 'left', wrapText: true };
  }
  const containerColumn = keptColumns.indexOf(selection.column) + 1;
  if (containerColumn > 0) sheet.getColumn(containerColumn).width = 22;
  sheet.getColumn(width + 1).width = 23;
  sheet.views = [{ state: 'frozen', ySplit: selection.start - 1 }];
  return workbook;
}
module.exports = { markedWorkbook };
