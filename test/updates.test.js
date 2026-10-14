const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { Updates } = require('../src/updates');

async function fixture() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'checker-updates-'));
  const updater = new EventEmitter();
  updater.setFeedURL = feed => { updater.feed = feed; };
  updater.checkForUpdates = async () => { updater.emit('checking-for-update'); updater.emit('update-available', { version: '0.7.0' }); };
  updater.downloadUpdate = async () => { updater.emit('download-progress', { percent: 60 }); updater.emit('update-downloaded', { version: '0.7.0' }); };
  updater.quitAndInstall = (...args) => { updater.installArgs = args; };
  const app = { isPackaged: true, getPath: () => dir, getVersion: () => '0.6.0' };
  const safeStorage = { isEncryptionAvailable: () => true, encryptString: value => Buffer.from('encrypted:' + value), decryptString: buffer => buffer.toString().slice(10) };
  const controller = new Updates({ app, safeStorage, updater, platform: 'win32' });
  return { dir, app, updater, safeStorage, controller, clean: () => fs.rm(dir, { recursive: true, force: true }) };
}
test('private update connection survives restart and only installs after download', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.controller.initialize()).phase, 'setup');
    assert.equal(f.controller.install(), false);
    assert.equal((await f.controller.connect('synthetic-test-token-1234567890')).phase, 'available');
    assert.equal(f.updater.feed.private, true);
    assert.equal(f.updater.feed.repo, 'LoadingListChecker');
    assert.ok(!(await fs.readFile(f.controller.tokenFile, 'utf8')).startsWith('synthetic-test-token'));
    assert.ok(!JSON.stringify(f.controller.state).includes('synthetic-test-token'));
    const restored = new Updates({ app: f.app, safeStorage: f.safeStorage, updater: f.updater, platform: 'win32' });
    assert.equal((await restored.initialize()).phase, 'available');
    const phases = []; restored.on('state', state => phases.push(state.phase));
    assert.equal((await restored.download()).phase, 'ready');
    assert.ok(phases.includes('downloading'));
    assert.equal(restored.install(), true);
    assert.deepEqual(f.updater.installArgs, [false, true]);
    assert.equal(f.updater.autoInstallOnAppQuit, false);
    assert.equal(f.updater.autoDownload, false);
  } finally { await f.clean(); }
});
test('update errors hide authenticated details and allow a retry', async () => {
  const f = await fixture();
  try {
    f.updater.checkForUpdates = async () => { throw new Error('Authorization: synthetic-test-token-1234567890'); };
    const state = await f.controller.connect('synthetic-test-token-1234567890');
    assert.equal(state.phase, 'error');
    assert.ok(!JSON.stringify(state).includes('synthetic-test-token'));
    f.updater.checkForUpdates = async () => f.updater.emit('update-not-available');
    assert.equal((await f.controller.check()).phase, 'idle');
    await f.controller.disconnect();
    assert.equal(f.controller.state.connected, false);
    await assert.rejects(fs.access(f.controller.tokenFile));
  } finally { await f.clean(); }
});
test('unavailable secure storage prevents saving credentials', async () => {
  const f = await fixture();
  try {
    f.safeStorage.isEncryptionAvailable = () => false;
    await assert.rejects(f.controller.connect('synthetic-test-token-1234567890'), /secure credential storage/);
    await assert.rejects(fs.access(f.controller.tokenFile));
    f.safeStorage.isEncryptionAvailable = () => true;
    f.safeStorage.getSelectedStorageBackend = () => 'basic_text';
    await assert.rejects(f.controller.connect('synthetic-test-token-1234567890'), /secure credential storage/);
  } finally { await f.clean(); }
});
test('blocks duplicate requests and connection changes during an update', async () => {
  const f = await fixture();
  try {
    await f.controller.connect('synthetic-test-token-1234567890');
    let finish; let downloads = 0;
    f.updater.downloadUpdate = () => { downloads++; return new Promise(resolve => { finish = resolve; }); };
    const first = f.controller.download();
    await f.controller.download(); await f.controller.check();
    assert.equal(downloads, 1);
    await assert.rejects(f.controller.disconnect(), /Finish the current update/);
    finish(); await first;
  } finally { await f.clean(); }
});
