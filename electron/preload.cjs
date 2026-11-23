'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// Only exposed on Windows; elsewhere the renderer falls back to its demo data so the UI can be developed on any OS.
if (process.platform === 'win32') {
  contextBridge.exposeInMainWorld('tickrate', {
    catalog: () => ipcRenderer.invoke('catalog:get'),
    call: (action, payload) => ipcRenderer.invoke('engine:call', action, payload),
    settings: () => ipcRenderer.invoke('settings:get'),
    setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
    info: () => ipcRenderer.invoke('app:info'),
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
    openDataFolder: () => ipcRenderer.invoke('shell:openDataFolder'),
    onLog: (cb) => {
      const handler = (_e, line) => cb(line);
      ipcRenderer.on('engine:log', handler);
      return () => ipcRenderer.removeListener('engine:log', handler);
    },
  });
}
