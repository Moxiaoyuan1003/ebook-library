import { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, Notification } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { setupAutoUpdater } from './updater';

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let reminderTimer: NodeJS.Timeout | null = null;

// ── Backend Lifecycle ──

function getBackendPath(): string {
  if (!app.isPackaged) return '';
  const ext = process.platform === 'win32' ? '.exe' : '';
  return path.join(process.resourcesPath, 'backend', `backend${ext}`);
}

function waitForHealth(url: string, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode === 200) resolve();
        else retry();
      }).on('error', retry);
    };
    const retry = () => {
      if (Date.now() - start > timeout) reject(new Error('Backend startup timeout'));
      else setTimeout(check, 500);
    };
    check();
  });
}

async function startBackend(): Promise<void> {
  if (!app.isPackaged) return;

  const backendPath = getBackendPath();
  const dataDir = path.join(app.getPath('userData'), 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  backendProcess = spawn(
    backendPath,
    ['--host', '127.0.0.1', '--port', '8000', '--data-dir', app.getPath('userData')],
    { stdio: 'pipe' },
  );

  backendProcess.stdout?.on('data', (data) => console.log(`[backend] ${data}`));
  backendProcess.stderr?.on('data', (data) => console.error(`[backend] ${data}`));
  backendProcess.on('exit', (code) => {
    console.log(`[backend] exited with code ${code}`);
    backendProcess = null;
  });

  await waitForHealth('http://127.0.0.1:8000/api/health', 30000);
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}

// ── Tray ──

function createTray() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '..', 'public', 'icon.png');

  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) throw new Error('empty icon');
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('个人图书管理系统');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ── Window ──

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1280,
    minHeight: 800,
    titleBarStyle: 'hiddenInset',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  if (app.isPackaged) {
    setupAutoUpdater(mainWindow);
  }
}

// ── IPC Handlers ──

function registerIpcHandlers() {
  ipcMain.handle('dialog:openFile', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Ebooks', extensions: ['pdf', 'epub', 'txt', 'mobi'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('dialog:selectDirectory', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('file:read', async (_event, filePath: string) => {
    try { return fs.readFileSync(filePath); } catch { return null; }
  });

  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window:close', () => mainWindow?.close());

  ipcMain.on('reminder:schedule', (_event, timeStr: string) => {
    if (reminderTimer) clearInterval(reminderTimer);

    const [hours, minutes] = timeStr.split(':').map(Number);

    const checkAndNotify = () => {
      const now = new Date();
      if (now.getHours() === hours && now.getMinutes() === minutes) {
        const notification = new Notification({
          title: '阅读提醒',
          body: '该读书啦！打开你的图书管理系统继续阅读吧。',
          silent: false,
        });
        notification.show();
        notification.on('click', () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        });
      }
    };

    reminderTimer = setInterval(checkAndNotify, 60000);
    checkAndNotify();
  });

  ipcMain.on('reminder:cancel', () => {
    if (reminderTimer) {
      clearInterval(reminderTimer);
      reminderTimer = null;
    }
  });
}

// ── App Lifecycle ──

app.whenReady().then(async () => {
  registerIpcHandlers();

  try {
    await startBackend();
  } catch (err) {
    console.error('Failed to start backend:', err);
  }

  createTray();
  createWindow();
});

app.on('window-all-closed', () => {
  // Don't quit when window closes — app stays in tray
});

app.on('before-quit', () => {
  isQuitting = true;
  stopBackend();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
