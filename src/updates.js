const fs = require('node:fs/promises');
const path = require('node:path');
const { EventEmitter } = require('node:events');

class Updates extends EventEmitter {
  constructor({ app, safeStorage, updater, platform = process.platform }) {
    super();
    this.app = app;
    this.storage = safeStorage;
    this.updater = updater;
    this.enabled = platform === 'win32' && app.isPackaged;
    this.tokenFile = path.join(app.getPath('userData'), 'github-updates.enc');
    this.connected = false;
    this.busy = false;
    this.state = { phase: this.enabled ? 'setup' : 'disabled', version: app.getVersion(), connected: false, message: this.enabled ? 'Connect GitHub once to receive updates from the private repository.' : 'Updates are available in the installed Windows app.' };
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowPrerelease = false;
    // Updater errors can contain authenticated request details. Show only safe messages.
    updater.logger = { info() {}, warn() {}, error() {}, debug() {} };
    updater.on('checking-for-update', () => this.set({ phase: 'checking', message: 'Checking for updates…' }));
    updater.on('update-available', info => this.set({ phase: 'available', latestVersion: info.version, message: `Version ${info.version} is available.` }));
    updater.on('update-not-available', () => this.set({ phase: 'idle', latestVersion: null, message: 'You have the latest version.' }));
    updater.on('download-progress', progress => this.set({ phase: 'downloading', progress: Math.max(0, Math.min(100, Math.round(progress.percent))), message: 'Downloading update…' }));
    updater.on('update-downloaded', info => this.set({ phase: 'ready', latestVersion: info.version, progress: 100, message: `Version ${info.version} is ready. Save your marked Excel before restarting.` }));
    updater.on('error', () => this.failure());
  }
  set(change) { this.state = { ...this.state, ...change, connected: this.connected }; this.emit('state', this.state); return this.state; }
  failure() { return this.set({ phase: 'error', message: 'Update failed. Check your connection and GitHub token access to this repository, then retry.' }); }
  encryptionAvailable() { return this.storage.isEncryptionAvailable() && this.storage.getSelectedStorageBackend?.() !== 'basic_text'; }
  configure(token) {
    this.updater.setFeedURL({ provider: 'github', owner: 'Ricoro', repo: 'LoadingListChecker', private: true, token });
    this.connected = true;
  }
  async initialize() {
    if (!this.enabled) return this.state;
    try {
      if (this.encryptionAvailable()) this.configure(this.storage.decryptString(await fs.readFile(this.tokenFile)));
    } catch (error) {
      if (error.code !== 'ENOENT') return this.set({ phase: 'setup', message: 'Reconnect GitHub to restore update access on this computer.' });
    }
    if (this.connected) return this.check();
    return this.state;
  }
  async connect(token) {
    if (!this.enabled) throw new Error('Use the installed Windows app to enable updates.');
    if (this.busy || this.state.phase === 'ready') throw new Error('Finish the current update before changing its connection.');
    if (!this.encryptionAvailable()) throw new Error('Windows secure credential storage is unavailable.');
    if (typeof token !== 'string' || token.trim().length < 20 || token.trim().length > 2048 || /\s/.test(token.trim())) throw new Error('Enter a valid GitHub access token.');
    const cleaned = token.trim();
    await fs.mkdir(path.dirname(this.tokenFile), { recursive: true });
    await fs.writeFile(this.tokenFile, this.storage.encryptString(cleaned), { mode: 0o600 });
    this.configure(cleaned);
    return this.check();
  }
  async check() {
    if (!this.enabled || this.busy || this.state.phase === 'ready') return this.state;
    if (!this.connected) return this.set({ phase: 'setup', message: 'Connect GitHub once to receive updates from the private repository.' });
    this.busy = true;
    try { await this.updater.checkForUpdates(); } catch { this.failure(); } finally { this.busy = false; }
    return this.state;
  }
  async download() {
    if (!this.connected || this.busy || this.state.phase !== 'available') return this.state;
    this.busy = true;
    this.set({ phase: 'downloading', progress: 0, message: 'Downloading update…' });
    try { await this.updater.downloadUpdate(); } catch { this.failure(); } finally { this.busy = false; }
    return this.state;
  }
  install() { if (this.state.phase !== 'ready') return false; this.updater.quitAndInstall(false, true); return true; }
  async disconnect() {
    if (this.busy || this.state.phase === 'ready') throw new Error('Finish the current update before disconnecting.');
    await fs.rm(this.tokenFile, { force: true });
    this.updater.setFeedURL({ provider: 'github', owner: 'Ricoro', repo: 'LoadingListChecker', private: true });
    this.connected = false;
    return this.set({ phase: 'setup', latestVersion: null, progress: 0, message: 'GitHub disconnected. Automatic update checks are disabled.' });
  }
}
module.exports = { Updates };
