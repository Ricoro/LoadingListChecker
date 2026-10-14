const fs = require('node:fs/promises');
const path = require('node:path');
const { EventEmitter } = require('node:events');

class Updates extends EventEmitter {
  constructor({ app, updater, platform = process.platform }) {
    super();
    this.app = app;
    this.updater = updater;
    this.enabled = platform === 'win32' && app.isPackaged;
    this.legacyTokenFile = path.join(app.getPath('userData'), 'github-updates.enc');
    this.busy = false;
    this.state = { phase: this.enabled ? 'idle' : 'disabled', version: app.getVersion(), message: this.enabled ? 'Updates are checked automatically from public GitHub releases.' : 'Updates are available in the installed Windows app.' };
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowPrerelease = false;
    // Keep transport errors out of the user interface.
    updater.logger = { info() {}, warn() {}, error() {}, debug() {} };
    updater.on('checking-for-update', () => this.set({ phase: 'checking', message: 'Checking for updates…' }));
    updater.on('update-available', info => this.set({ phase: 'available', latestVersion: info.version, message: `Version ${info.version} is available.` }));
    updater.on('update-not-available', () => this.set({ phase: 'idle', latestVersion: null, message: 'You have the latest version.' }));
    updater.on('download-progress', progress => this.set({ phase: 'downloading', progress: Math.max(0, Math.min(100, Math.round(progress.percent))), message: 'Downloading update…' }));
    updater.on('update-downloaded', info => this.set({ phase: 'ready', latestVersion: info.version, progress: 100, message: `Version ${info.version} is ready. Save your marked Excel before restarting.` }));
    updater.on('error', () => this.failure());
    if (this.enabled) updater.setFeedURL({ provider: 'github', owner: 'Ricoro', repo: 'LoadingListChecker', private: false });
  }
  set(change) { this.state = { ...this.state, ...change }; this.emit('state', this.state); return this.state; }
  failure() { return this.set({ phase: 'error', message: 'Update failed. Check your internet connection and try again.' }); }
  async initialize() {
    if (!this.enabled) return this.state;
    // Remove the obsolete encrypted token without reading or decrypting it.
    // A cleanup failure must not block public updates.
    await fs.rm(this.legacyTokenFile, { force: true }).catch(() => {});
    return this.check();
  }
  async check() {
    if (!this.enabled || this.busy || this.state.phase === 'ready') return this.state;
    this.busy = true;
    try { await this.updater.checkForUpdates(); } catch { this.failure(); } finally { this.busy = false; }
    return this.state;
  }
  async download() {
    if (!this.enabled || this.busy || this.state.phase !== 'available') return this.state;
    this.busy = true;
    this.set({ phase: 'downloading', progress: 0, message: 'Downloading update…' });
    try { await this.updater.downloadUpdate(); } catch { this.failure(); } finally { this.busy = false; }
    return this.state;
  }
  install() { if (this.state.phase !== 'ready') return false; this.updater.quitAndInstall(false, true); return true; }
}
module.exports = { Updates };
