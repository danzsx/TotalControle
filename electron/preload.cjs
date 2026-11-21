const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('totalControleDesktop', {
  isDesktop: true,
  loadDbBytes: () => ipcRenderer.invoke('db:load'),
  saveDbBytes: (bytesArray) => ipcRenderer.invoke('db:save', bytesArray),
  quarantineDb: () => ipcRenderer.invoke('db:quarantine'),
  getDbLocation: () => ipcRenderer.invoke('db:location'),
  revealDataFolder: () => ipcRenderer.invoke('db:reveal-folder'),
  exportTextFile: (payload) => ipcRenderer.invoke('files:export', payload),
  exportSqliteFile: (payload) => ipcRenderer.invoke('files:export-sqlite', payload),
});

