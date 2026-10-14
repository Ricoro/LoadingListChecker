const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('checker', { import: side => ipcRenderer.invoke('import', side), compare: selections => ipcRenderer.invoke('compare', selections), exportMarked: selections => ipcRenderer.invoke('export-marked', selections), updates: {
  get: () => ipcRenderer.invoke('updates:get'), check: () => ipcRenderer.invoke('updates:check'),
  connect: token => ipcRenderer.invoke('updates:connect', token), disconnect: () => ipcRenderer.invoke('updates:disconnect'),
  download: () => ipcRenderer.invoke('updates:download'), install: () => ipcRenderer.invoke('updates:install'),
  onState: callback => { const listener = (_, state) => callback(state); ipcRenderer.on('updates:state', listener); return () => ipcRenderer.removeListener('updates:state', listener); }
} });
