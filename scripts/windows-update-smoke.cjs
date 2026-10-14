// Executes under Electron on the Windows CI runner, never in the shipped app.
const { app } = require('electron');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const packagedRequire = require('node:module').createRequire(path.join(process.cwd(), 'dist/win-unpacked/resources/app.asar/package.json'));
const { NsisUpdater } = packagedRequire('electron-updater');
const { ElectronHttpExecutor } = packagedRequire('electron-updater/out/electronHttpExecutor');
const { Updates } = packagedRequire('./src/updates');
const { version } = require('../package.json');
let temporary;
const timeout = setTimeout(() => { console.error('Native update smoke test timed out.'); app.exit(1); }, 120000);
app.whenReady().then(async () => {
  assert.equal(process.platform, 'win32');
  assert.ok(!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN);
  temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'checker-native-updates-'));
  // Exercise imports and marked Excel using the actual trimmed application archive.
  const XLS = packagedRequire('@e965/xlsx');
  const { readList } = packagedRequire('./src/import');
  const { markedWorkbook } = packagedRequire('./src/marked-workbook');
  const ExcelJS = packagedRequire('exceljs');
  const legacy = XLS.utils.book_new();
  XLS.utils.book_append_sheet(legacy, XLS.utils.aoa_to_sheet([['Cont. No', 'Booking No', 'Seal No'], ['MSCU1234567', 'BOOK1', 'SEAL'], ['', 'BOOK2', '']]), 'Vessel');
  const file = path.join(temporary, 'loading.xls');
  XLS.writeFile(legacy, file, { bookType: 'biff8' });
  const [imported] = await readList(file);
  const output = markedWorkbook(imported, { column: 0, start: 2 }, [['MSCU1234567']], 0);
  const marked = new ExcelJS.Workbook(); await marked.xlsx.load(await output.xlsx.writeBuffer());
  assert.equal(marked.worksheets[0].getCell('C2').value, 'Delivered');
  assert.equal(marked.worksheets[0].getCell('C3').value, 'No containernumber');
  const xlsx = path.join(temporary, 'marked.xlsx'); await output.xlsx.writeFile(xlsx);
  assert.equal((await readList(xlsx))[0].rows[1][0], 'MSCU1234567');
  const csv = path.join(temporary, 'terminal.csv'); await fs.writeFile(csv, 'Container\nMSCU1234567\n');
  assert.equal((await readList(csv))[0].rows[1][0], 'MSCU1234567');
  console.log('Trimmed packaged application: XLS, XLSX, CSV and marked Excel verified.');
  // Simulate a prior installed version while keeping the actual Windows
  // Electron HTTPS transport and NSIS download verification.
  const adapter = { version: '0.5.0', name: 'loading-list-checker', isPackaged: true,
    appUpdateConfigPath: path.join(process.cwd(), 'dist/win-unpacked/resources/app-update.yml'),
    userDataPath: temporary, baseCachePath: temporary,
    whenReady: () => Promise.resolve(), relaunch() {}, quit() {}, onQuit() {} };
  const updater = new NsisUpdater(null, adapter);
  updater.httpExecutor = new ElectronHttpExecutor((_, callback) => callback());
  let downloaded;
  const download = updater.downloadUpdate.bind(updater);
  updater.downloadUpdate = async (...args) => { downloaded = await download(...args); return downloaded; };
  const controller = new Updates({ app: { isPackaged: true, getVersion: () => adapter.version, getPath: () => temporary }, updater });
  assert.equal((await controller.initialize()).phase, 'available');
  assert.equal(controller.state.latestVersion, version);
  assert.equal((await controller.download()).phase, 'ready');
  const received = await fs.readFile(downloaded.find(file => file.endsWith('.exe')));
  const expected = await fs.readFile(`dist/Loading-List-Checker-Setup-${version}.exe`);
  assert.equal(crypto.createHash('sha512').update(received).digest('hex'), crypto.createHash('sha512').update(expected).digest('hex'));
  console.log('Public release detection without credentials and verified installer download passed.');
}).then(async () => {
  clearTimeout(timeout);
  if (temporary) await fs.rm(temporary, { recursive: true, force: true });
  app.exit(0);
}).catch(async () => {
  clearTimeout(timeout);
  if (temporary) await fs.rm(temporary, { recursive: true, force: true }).catch(() => {});
  console.error('Native Windows update smoke test failed. ');
  app.exit(1);
});
