const fs = require('node:fs');
const path = require('node:path');
const { version } = require('../package.json');
function size(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).reduce((total, item) => {
    const file = path.join(directory, item.name);
    return total + (item.isDirectory() ? size(file) : fs.statSync(file).size);
  }, 0);
}
const bytes = size('dist/win-unpacked');
const report = { version, windowsPayloadBytes: bytes, windowsPayloadMiB: Number((bytes / 1048576).toFixed(1)) };
fs.writeFileSync('dist/package-size.json', JSON.stringify(report, null, 2) + '\n');
console.log(`Windows application payload: ${report.windowsPayloadMiB} MiB (${bytes} bytes).`);
