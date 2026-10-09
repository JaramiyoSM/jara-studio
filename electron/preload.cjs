const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('jaraDesktop', {
  isDesktop: true,
  getVersion: () => ipcRenderer.invoke('jara:version'),
  openFiles: (options) => ipcRenderer.invoke('jara:open-files', options),
  saveFile: (options) => ipcRenderer.invoke('jara:save-file', options),
  openProject: () => ipcRenderer.invoke('jara:open-project'),
  saveProject: (options) => ipcRenderer.invoke('jara:save-project', options),
  saveRecovery: (bytes) => ipcRenderer.invoke('jara:save-recovery', bytes),
  loadRecovery: () => ipcRenderer.invoke('jara:load-recovery'),
  clearRecovery: () => ipcRenderer.invoke('jara:clear-recovery'),
  openExternal: (url) => ipcRenderer.invoke('jara:open-external', url),
  setUnsaved: (module, dirty) => ipcRenderer.invoke('jara:set-unsaved', module, dirty),
  onCommand: (callback) => {
    if (typeof callback !== 'function') return;
    const listener = (_event, command) => callback(command);
    ipcRenderer.on('jara:command', listener);
    return () => ipcRenderer.removeListener('jara:command', listener);
  },
});
