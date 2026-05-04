import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),

  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Update (electron-updater)
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  onUpdateAvailable: (callback: (info: unknown) => void) =>
    ipcRenderer.on('update-available', (_event, info) => callback(info)),
  onUpdateDownloaded: (callback: () => void) =>
    ipcRenderer.on('update-downloaded', () => callback()),
  onDownloadProgress: (callback: (data: { percent: number }) => void) =>
    ipcRenderer.on('download-progress', (_event, data) => callback(data)),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  installUpdate: () => ipcRenderer.send('install-update'),
});
