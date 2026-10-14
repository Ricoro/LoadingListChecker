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
  updater.checkForUpdates = async () => { updater.emit('checking-for-update'); updater.emit('update-available', { version: '0.8.0' }); };
  updater.downloadUpdate = async () => { updater.emit('download-progress', { percent: 60 }); updater.emit('update-downloaded', { version: '0.8.0' }); };
  updater.quitAndInstall = (...args) => { updater.installArgs = args; };
  const app = { isPackaged: true, getPath: () => dir, getVersion: () => '0.7.0' };
  const controller = new Updates({ app, updater, platform: 'win32' });
  return { dir, app, updater, controller, clean: () => fs.rm(dir, { recursive: true, force: true }) };
}
test('public updates need no token and remove the obsolete encrypted credential', async () => {
  const f = await fixture();
  try {
    await fs.writeFile(f.controller.legacyTokenFile, 'obsolete encrypted data');
    assert.equal(f.controller.install(), false);
    assert.equal((await f.controller.initialize()).phase, 'available');
    assert.equal(f.updater.feed.private, false);
    assert.equal(f.updater.feed.repo, 'LoadingListChecker');
    assert.equal('token' in f.updater.feed, false);
    await assert.rejects(fs.access(f.controller.legacyTokenFile));
    assert.equal((await f.controller.download()).phase, 'ready');
    assert.equal(f.controller.install(), true);
    assert.deepEqual(f.updater.installArgs, [false, true]);
    assert.equal(f.updater.autoInstallOnAppQuit, false);
    assert.equal(f.updater.autoDownload, false);
  } finally { await f.clean(); }
});
test('network errors permit retry without credentials', async () => {
  const f = await fixture();
  try {
    f.updater.checkForUpdates = async () => { throw new Error('network unavailable'); };
    assert.equal((await f.controller.initialize()).phase, 'error');
    assert.match(f.controller.state.message, /internet connection/);
    f.updater.checkForUpdates = async () => f.updater.emit('update-not-available');
    assert.equal((await f.controller.check()).phase, 'idle');
  } finally { await f.clean(); }
});
test('development environments do not run automatic updates', async () => {
  const f = await fixture();
  try {
    let checks = 0; f.updater.checkForUpdates = async () => { checks++; };
    const controller = new Updates({ app: { ...f.app, isPackaged: false }, updater: f.updater, platform: 'win32' });
    assert.equal((await controller.initialize()).phase, 'disabled');
    await controller.check(); await controller.download();
    assert.equal(checks, 0);
  } finally { await f.clean(); }
});
test('blocks duplicate requests and requires restart approval after download', async () => {
  const f = await fixture();
  try {
    await f.controller.initialize();
    let finish; let downloads = 0;
    f.updater.downloadUpdate = () => { downloads++; return new Promise(resolve => { finish = resolve; }); };
    const first = f.controller.download();
    await f.controller.download(); await f.controller.check();
    assert.equal(downloads, 1);
    assert.equal(f.controller.install(), false);
    finish(); await first;
  } finally { await f.clean(); }
});
