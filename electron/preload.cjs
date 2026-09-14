const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('desktop', {
  sources: () => ipcRenderer.invoke('sources'),
  selectSource: (id) => ipcRenderer.invoke('select-source', id),
  setControl: (id) => ipcRenderer.invoke('set-control', id),
  pointerInput: (event) => ipcRenderer.invoke('pointer-input', event),
  displays: () => ipcRenderer.invoke('displays'),
  moveTo: (id) => ipcRenderer.invoke('move-to', id),
  windowState: () => ipcRenderer.invoke('window-state'),
  windowAction: (action) => ipcRenderer.invoke('window-action', action),
  onWindowState: (handler) => {
    const listener = (_, value) => handler(value)
    ipcRenderer.on('window-state', listener)
    return () => ipcRenderer.removeListener('window-state', listener)
  },
  cropScreen: () => ipcRenderer.invoke('crop-screen'),
  copy: (data) => ipcRenderer.invoke('copy-image', data),
  save: (data) => ipcRenderer.invoke('save-image', data),
  clipboardImage: () => ipcRenderer.invoke('clipboard-image'),
  onCapture: (handler) => {
    const listener = (_, value) => handler(value)
    ipcRenderer.on('capture', listener)
    return () => ipcRenderer.removeListener('capture', listener)
  },
  onCommand: (handler) => {
    const listener = (_, value) => handler(value)
    ipcRenderer.on('command', listener)
    return () => ipcRenderer.removeListener('command', listener)
  },
})
