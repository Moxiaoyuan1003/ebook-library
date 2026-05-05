import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),

  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  resize: (bounds: { x?: number; y?: number; width?: number; height?: number }) =>
    ipcRenderer.send('window:resize', bounds),
  getBounds: (): Promise<{ x: number; y: number; width: number; height: number }> =>
    ipcRenderer.invoke('window:getBounds'),

  // Reminders
  scheduleReminder: (time: string) => ipcRenderer.send('reminder:schedule', time),
  cancelReminder: () => ipcRenderer.send('reminder:cancel'),

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
