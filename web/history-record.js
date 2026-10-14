const { createEmailDraft } = require('../src/email-draft');
function encodeBytes(bytes) {
  let binary = '';
  for (let i=0; i<bytes.length; i+=16384) binary += String.fromCharCode(...bytes.subarray(i,i+16384));
  return btoa(binary);
}
function decodeBytes(value) { return Uint8Array.from(atob(value), char => char.charCodeAt(0)); }
function validateRecord(record) {
  if (record?.formatVersion !== 1 || !/^[0-9a-f-]{36}$/i.test(record.id || '') || !record.result || !Array.isArray(record.result.results) || !Array.isArray(record.result.loadingRows) || record.result.loadingRows.length > 100000 || record.result.results.length > 100000 || typeof record.excelBase64 !== 'string' || record.excelBase64.length > 28 * 1024 * 1024) throw new Error('This saved comparison has an unsupported format.');
  const statuses = new Set(['Delivered','Outstanding','Blocked','No containernumber']);
  for (const row of [...record.result.results, ...record.result.loadingRows]) {
    if (typeof row.container !== 'string' || row.container.length > 64 || !statuses.has(row.status)) throw new Error('This saved comparison contains invalid rows.');
  }
  const bytes = decodeBytes(record.excelBase64);
  if (bytes.length < 4 || bytes[0] !== 80 || bytes[1] !== 75) throw new Error('The saved Excel attachment is invalid.');
  return record;
}
function makeRecord({ id, result, sources, excelBytes }) {
  // Save the vessel comparison, not the terminal's unrelated container numbers.
  const savedResult = { ...result, quayOnlyCount: result.quayOnly.length, quayOnly: [] };
  return validateRecord({ formatVersion: 1, id, result: savedResult, sources, excelBase64: encodeBytes(new Uint8Array(excelBytes)) });
}
function recordMail(record) {
  validateRecord(record);
  const data = record.result;
  return createEmailDraft({ workbookBytes: decodeBytes(record.excelBase64), vesselName: data.vesselName, summary: { ...data, onTerminal: data.results.filter(row=>['Delivered','Blocked'].includes(row.status)).length, outstanding: data.results.filter(row=>row.status==='Outstanding').length } });
}
function displayTimestamp(timestamp) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle:'medium', timeStyle:'short', timeZone:'Europe/Brussels' }).format(new Date(timestamp));
}
module.exports = { makeRecord, validateRecord, decodeBytes, recordMail, displayTimestamp };
