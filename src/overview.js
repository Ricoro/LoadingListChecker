const { normalize, extract } = require('./compare');
const { blockedContainers } = require('./terminal');
function teuForSize(value) {
  const length = String(value ?? '').match(/(?:^|[^0-9])(20|23|40|45)(?=[^0-9]|$)/)?.[1];
  return length === '20' ? 1 : length === '23' ? 3 : length ? 2 : null;
}
function overview(sheet, selection, quayRows, quayColumn, blockedColumn = 4) {
  const blocked = blockedContainers(quayRows, quayColumn, blockedColumn);
  const terminal = extract(quayRows, quayColumn).containers;
  const headers = sheet.rows[selection.start - 2] || [];
  const find = regex => headers.findIndex(value => regex.test(String(value).trim()));
  const booking = find(/^booking/i), size = find(/^size$/i), type = find(/^type$/i);
  const rows = [];
  sheet.rows.slice(selection.start - 1).forEach((values, offset) => {
    const container = normalize(values[selection.column]);
    const valid = /^[A-Z]{4}\d{7}$/.test(container);
    if (!valid && !(booking >= 0 && String(values[booking] || '').trim())) return;
    rows.push({ sourceRow: selection.start + offset, container, booking: values[booking] || '', size: values[size] || (size >= 0 ? values[size + 1] : '') || '', type: values[type] || '', status: valid ? (blocked.has(container) ? 'Blocked' : terminal.has(container) ? 'Delivered' : 'Outstanding') : 'No containernumber' });
  });
  const vesselLine = sheet.rows.slice(0, selection.start - 1).find(row => row.some(value => /^M\/V\s/i.test(String(value))));
  const declaredMatch = sheet.rows.flat().map(String).join(' ').match(/TOTAL\s+units\s*:\s*(\d+)/i);
  const declaredTotal = declaredMatch ? Number(declaredMatch[1]) : null;
  const numberedRows = rows.filter(row => row.status !== 'No containernumber').length;
  const blankBookingRows = rows.filter(row => !row.container).length;
  const invalidNumbers = rows.filter(row => row.container && row.status === 'No containernumber').length;
  const numberedContainers = new Set(rows.filter(row => row.status !== 'No containernumber').map(row => row.container)).size;
  const containerBookings = new Map();
  for (const row of rows.filter(row => row.status !== 'No containernumber')) {
    const bookings = containerBookings.get(row.container) || new Set();
    bookings.add(String(row.booking).trim().toUpperCase()); containerBookings.set(row.container, bookings);
  }
  const bookingConflicts = [...containerBookings].filter(([, bookings]) => bookings.size > 1).map(([container, bookings]) => ({container, bookings:[...bookings]}));
  const countedContainers = numberedContainers + blankBookingRows + invalidNumbers;
  const additionalBillRows = numberedRows - numberedContainers;
  const bookedTotal = declaredTotal ?? countedContainers;
  const awaitingNumbers = bookedTotal - numberedContainers;
  const declaredTeuMatch = sheet.rows.flat().map(String).join(' ').match(/TOTAL\s+TEUs?\s*:\s*(\d+(?:[.,]\d+)?)/i);
  const declaredTeu = declaredTeuMatch ? Number(declaredTeuMatch[1].replace(',', '.')) : null;
  const uniqueRows = new Map();
  for (const row of rows.filter(row => row.status !== 'No containernumber')) {
    if (!uniqueRows.has(row.container) || teuForSize(uniqueRows.get(row.container).size) == null) uniqueRows.set(row.container, row);
  }
  const sumTeu = items => items.some(row => teuForSize(row.size) == null) ? null : items.reduce((total,row) => total + teuForSize(row.size), 0);
  const bookedRows = [...uniqueRows.values(), ...rows.filter(row => row.status === 'No containernumber')];
  // Lapro includes 23 ft units as 1 TEU; the line's requested rule is 3 TEU.
  const extra23Teu = bookedRows.filter(row => teuForSize(row.size) === 3).length * 2;
  const bookedTeu = declaredTeu == null ? sumTeu(bookedRows) : declaredTeu + extra23Teu;
  const terminalTeu = sumTeu([...uniqueRows.values()].filter(row => ['Delivered','Blocked'].includes(row.status)));
  const blockedTeu = sumTeu([...uniqueRows.values()].filter(row => row.status === 'Blocked'));
  return { bookedTeu, terminalTeu, blockedTeu, blankBookingRows, bookingConflicts, numberedContainers, countedContainers, additionalBillRows, bookedTotal, declaredTotal, countedBookingRows: rows.length, numberedRows, awaitingNumbers, invalidNumbers, loadingRows: rows, vesselName: vesselLine?.find(value => /^M\/V\s/i.test(String(value))) || '', missingNumbers: rows.filter(row => row.status === 'No containernumber').length };
}
module.exports = { overview };
