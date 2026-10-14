const { normalize, extract } = require('./compare');
function overview(sheet, selection, quayRows, quayColumn) {
  const terminal = extract(quayRows, quayColumn).containers;
  const headers = sheet.rows[selection.start - 2] || [];
  const find = regex => headers.findIndex(value => regex.test(String(value).trim()));
  const booking = find(/^booking/i), size = find(/^size$/i), type = find(/^type$/i);
  const rows = [];
  sheet.rows.slice(selection.start - 1).forEach((values, offset) => {
    const container = normalize(values[selection.column]);
    const valid = /^[A-Z]{4}\d{7}$/.test(container);
    if (!valid && !(booking >= 0 && String(values[booking] || '').trim())) return;
    rows.push({ sourceRow: selection.start + offset, container, booking: values[booking] || '', size: values[size] || '', type: values[type] || '', status: valid ? (terminal.has(container) ? 'Delivered' : 'Outstanding') : 'Cannot match' });
  });
  const vesselLine = sheet.rows.slice(0, selection.start - 1).find(row => row.some(value => /^M\/V\s/i.test(String(value))));
  const declaredMatch = sheet.rows.flat().map(String).join(' ').match(/TOTAL\s+units\s*:\s*(\d+)/i);
  const declaredTotal = declaredMatch ? Number(declaredMatch[1]) : null;
  const numberedRows = rows.filter(row => row.status !== 'Cannot match').length;
  const awaitingNumbers = rows.filter(row => !row.container).length;
  const invalidNumbers = rows.filter(row => row.container && row.status === 'Cannot match').length;
  const numberedContainers = new Set(rows.filter(row => row.status !== 'Cannot match').map(row => row.container)).size;
  const countedContainers = numberedContainers + awaitingNumbers + invalidNumbers;
  const additionalBillRows = numberedRows - numberedContainers;
  return { numberedContainers, countedContainers, additionalBillRows, bookedTotal: declaredTotal ?? countedContainers, declaredTotal, countedBookingRows: rows.length, numberedRows, awaitingNumbers, invalidNumbers, loadingRows: rows, vesselName: vesselLine?.find(value => /^M\/V\s/i.test(String(value))) || '', missingNumbers: rows.filter(row => row.status === 'Cannot match').length };
}
module.exports = { overview };
