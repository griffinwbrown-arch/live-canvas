const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('crop', {
  ready: () => ipcRenderer.invoke('crop-ready'),
  commit: (rect) => ipcRenderer.send('crop-commit', rect),
  cancel: () => ipcRenderer.send('crop-cancel'),
})
