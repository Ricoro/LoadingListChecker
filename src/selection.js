function suggestSelection(rows, side) {
  const preferred = side === 'vessel' ? 4 : 2;
  const header = /^(cont\.?\s*(no\.?|number)|container(\s*(no\.?|number))?|unit\s*id)$/i;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const found = rows[i].findIndex(value => header.test(String(value).trim()));
    if (found >= 0) return { column: found, start: i + 2 };
  }
  const column = rows.some(row => /^[A-Z]{4}\d{7}$/.test(String(row[preferred] || '').replace(/[\s-]/g, '').toUpperCase())) ? preferred : 0;
  const first = rows.findIndex(row => /^[A-Z]{4}\d{7}$/.test(String(row[column] || '').replace(/[\s-]/g, '').toUpperCase()));
  return { column, start: first >= 0 ? first + 1 : 2 };
}
function suggestBlockedColumn(rows) {
  for (const row of rows.slice(0, 30)) {
    const column = row.findIndex(value => /^blocked$/i.test(String(value).trim()));
    if (column >= 0) return column;
  }
  return -1;
}
module.exports = { suggestSelection, suggestBlockedColumn };
