const { normalize } = require('./compare');
function blockedContainers(rows, containerColumn, blockedColumn = 4) {
  const blocked = new Set();
  if (blockedColumn < 0) return blocked;
  for (const row of rows) {
    const number = normalize(row[containerColumn]);
    if (/^[A-Z]{4}\d{7}$/.test(number) && String(row[blockedColumn] ?? '').trim().toLowerCase() === 'yes') blocked.add(number);
  }
  return blocked;
}
module.exports = { blockedContainers };
