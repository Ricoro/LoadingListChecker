function base64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 16384) binary += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
  return btoa(binary);
}
function wrappedBase64(bytes) { return base64(bytes).match(/.{1,76}/g)?.join('\r\n') || ''; }
function subjectHeader(value) {
  const clean = String(value).replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, 250);
  const encoder = new TextEncoder();
  const chunks = []; let chunk = '';
  for (const char of clean) {
    if (encoder.encode(chunk + char).length > 42) { chunks.push(chunk); chunk = ''; }
    chunk += char;
  }
  if (chunk) chunks.push(chunk);
  return chunks.map(text => `=?UTF-8?B?${base64(encoder.encode(text))}?=`).join('\r\n ');
}
function createEmailDraft({ workbookBytes, vesselName = '', summary = {}, createdAt = new Date() }) {
  const timestamp = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Brussels',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(createdAt);
  const boundary = `loading-checker-${crypto.randomUUID()}`;
  const body = `Please find the marked loading list attached${vesselName ? ` for ${vesselName}` : ''}.\r\n\r\nTotal booked containers: ${summary.bookedTotal ?? ''}\r\nTotal TEU booked: ${summary.bookedTeu ?? 'Unavailable'}\r\nContainers on terminal: ${summary.onTerminal ?? ''}\r\nTotal TEU on terminal: ${summary.terminalTeu ?? 'Unavailable'}\r\nContainers blocked on terminal: ${summary.blockedCount ?? ''}\r\nContainers not on terminal: ${summary.outstanding ?? ''}\r\nAwaiting container numbers: ${summary.awaitingNumbers ?? ''}\r\n\r\nDeep red = blocked on terminal; green = delivered; amber = outstanding; grey = no containernumber.`;
  return [
    'X-Unsent: 1', 'MIME-Version: 1.0', `Date: ${createdAt.toUTCString()}`,
    `Subject: ${subjectHeader(`Terminal container overview${vesselName ? ` - ${vesselName}` : ''} - ${timestamp}`)}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`, '',
    `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '',
    wrappedBase64(new TextEncoder().encode(body)), '',
    `--${boundary}`, 'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; name="marked-loading-list.xlsx"',
    'Content-Disposition: attachment; filename="marked-loading-list.xlsx"', 'Content-Transfer-Encoding: base64', '',
    wrappedBase64(new Uint8Array(workbookBytes)), '', `--${boundary}--`, ''
  ].join('\r\n');
}
module.exports = { createEmailDraft };
