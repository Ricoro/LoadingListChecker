function normalize(value) {
  return String(value ?? '').trim().toUpperCase().replace(/[\s-]/g, '');
}
function extract(rows, column) {
  const containers = new Set();
  let duplicates = 0, invalid = 0, blank = 0;
  for (const row of rows) {
    const id = normalize(row[column]);
    if (!id) { blank++; continue; }
    if (!/^[A-Z]{4}\d{7}$/.test(id)) { invalid++; continue; }
    if (containers.has(id)) duplicates++;
    containers.add(id);
  }
  return { containers, duplicates, invalid, blank };
}
function compare(vesselRows, vesselColumn, quayRows, quayColumn, blockedColumn = 4) {
  const blocked = require('./terminal').blockedContainers(quayRows, quayColumn, blockedColumn);
  const vessel = extract(vesselRows, vesselColumn), quay = extract(quayRows, quayColumn);
  const results = [...vessel.containers].sort().map(container => ({ container, status: blocked.has(container) ? 'Blocked' : quay.containers.has(container) ? 'Delivered' : 'Outstanding' }));
  const quayOnly = [...quay.containers].filter(id => !vessel.containers.has(id)).sort();
  return { blockedCount: results.filter(row => row.status === 'Blocked').length, results, quayOnly, vessel: { ...vessel, containers: vessel.containers.size }, quay: { ...quay, containers: quay.containers.size } };
}
module.exports = { normalize, extract, compare };
