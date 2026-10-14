const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { readList, suggestSelection } = require('./import');
const { overview } = require('./overview');
const { markedWorkbook } = require('./marked-workbook');
const { compare } = require('./compare');
const { Updates } = require('./updates');
let window;
let updates;
ipcMain.handle('updates:get', () => updates?.state);
ipcMain.handle('updates:check', () => updates?.check());
ipcMain.handle('updates:download', () => updates?.download());
ipcMain.handle('updates:install', async () => {
  if (updates?.state.phase !== 'ready') return false;
  const answer = await dialog.showMessageBox(window, { type: 'question', buttons: ['Restart and update', 'Keep working'], defaultId: 1, cancelId: 1, title: 'Install update', message: 'Save your marked Excel before restarting.', detail: 'Your current imported lists and comparison will close. The update will install and reopen the app.' });
  return answer.response === 0 ? updates.install() : false;
});
const imports = new Map();
ipcMain.handle('import', async (_, side) => {
  if (!['vessel', 'quay'].includes(side)) throw new Error('Invalid list.');
  const chosen = await dialog.showOpenDialog(window, { properties: ['openFile'], filters: [{ name: 'Container lists', extensions: ['xls', 'xlsx', 'csv'] }] });
  if (chosen.canceled) return null;
  const file = chosen.filePaths[0];
  const stat = await fs.stat(file);
  if (stat.size > 25 * 1024 * 1024) throw new Error('Please choose a file smaller than 25 MB.');
  const sheets = await readList(file);
  imports.set(side, sheets);
  return { name: path.basename(file), sheets: sheets.map(s => ({ suggested: suggestSelection(s.rows, side), name: s.name, count: s.rows.length, preview: s.rows.slice(0, 20), columns: Math.max(0, ...s.rows.slice(0, 20).map(r => r.length)) })) };
});
function compareSelections(selections) {
  function selected(side) {
    const selection = selections?.[side];
    if (!selection) throw new Error('Import both lists first.');
    const sheet = imports.get(side)?.[selection.sheet];
    if (!sheet || !Number.isInteger(selection.column) || selection.column < 0 || !Number.isInteger(selection.start) || selection.start < 1) throw new Error('Import both lists and choose their columns and first data rows.');
    return { rows: sheet.rows.slice(selection.start - 1), column: selection.column };
  }
  const vessel = selected('vessel'), quay = selected('quay');
  return { ...compare(vessel.rows, vessel.column, quay.rows, quay.column), ...overview(imports.get('vessel')[selections.vessel.sheet], selections.vessel, quay.rows, quay.column) };
}
ipcMain.handle('compare', (_, selections) => compareSelections(selections));
ipcMain.handle('export-marked', async (_, selections) => {
  compareSelections(selections);
  const chosen = await dialog.showSaveDialog(window, { defaultPath: 'marked-loading-list.xlsx', filters: [{ name: 'Excel', extensions: ['xlsx'] }] });
  if (chosen.canceled) return false;
  const q = selections.quay;
  const workbook = markedWorkbook(imports.get('vessel')[selections.vessel.sheet], selections.vessel, imports.get('quay')[q.sheet].rows.slice(q.start - 1), q.column);
  await workbook.xlsx.writeFile(chosen.filePath);
  return true;
});
app.whenReady().then(() => {
  window = new BrowserWindow({ width: 1180, height: 860, minWidth: 900, minHeight: 650, backgroundColor: '#f5f7fa', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.loadFile(path.join(__dirname, 'index.html'));
  if (app.isPackaged && process.platform === 'win32') {
    updates = new Updates({ app, updater: require('electron-updater').autoUpdater });
    updates.on('state', state => { if (!window.isDestroyed()) window.webContents.send('updates:state', state); });
    updates.initialize().catch(() => updates.failure());
    const timer = setInterval(() => updates.check().catch(() => updates.failure()), 4 * 60 * 60 * 1000);
    timer.unref();
    app.on('before-quit', () => clearInterval(timer));
  }
});
app.on('window-all-closed', () => app.quit());
