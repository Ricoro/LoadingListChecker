const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('checker', { import: side => ipcRenderer.invoke('import', side), compare: selections => ipcRenderer.invoke('compare', selections), exportMarked: selections => ipcRenderer.invoke('export-marked', selections), export: selections => ipcRenderer.invoke('export', selections) });
