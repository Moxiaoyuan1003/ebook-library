# Desktop Packaging & Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the Electron + React + FastAPI ebook library as a distributable desktop application with SQLite, PyInstaller, and auto-update.

**Architecture:** Backend is bundled via PyInstaller as a single binary, launched as a child process by Electron. Database switches from PostgreSQL to SQLite for zero-config desktop use. Auto-update via electron-updater + GitHub Releases.

**Tech Stack:** PyInstaller, SQLite, SQLAlchemy, electron-builder, electron-updater, GitHub Actions

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `backend/app/core/types.py` | SQLiteUUID TypeDecorator (shared utility) |
| `backend/app/core/cli.py` | CLI entry point with argparse (--host, --port, --data-dir) |
| `backend/backend.spec` | PyInstaller spec file |
| `backend/build.sh` | Backend build script (Unix) |
| `backend/build.bat` | Backend build script (Windows) |
| `frontend/electron-builder.yml` | Electron Builder config |
| `frontend/electron/updater.ts` | Auto-update logic (main process) |
| `frontend/src/components/UpdateModal.tsx` | Update notification UI (renderer) |
| `.github/workflows/release.yml` | Release CI pipeline |

### Modified Files

| File | Changes |
|------|---------|
| `backend/app/core/config.py` | SQLite default URL, data-dir aware paths |
| `backend/app/core/database.py` | SQLite engine config, init_database() |
| `backend/app/models/passage.py` | Guard pgvector import for SQLite |
| `backend/app/models/reading_session.py` | Fix JSON import to be dialect-agnostic |
| `backend/app/services/search/engine.py` | Guard vector search for SQLite |
| `backend/app/main.py` | Import cli module for __main__ entry |
| `backend/requirements.txt` | Add pyinstaller |
| `frontend/electron/main.ts` | Backend lifecycle, IPC handlers, update integration |
| `frontend/electron/preload.ts` | Add update IPC, backend URL |
| `frontend/vite.config.ts` | Add `base: './'` for file:// loading |
| `frontend/package.json` | Add electron-updater, build scripts, fix main field |
| `frontend/src/components/UpdateChecker.tsx` | Refactor to use Electron IPC |

---

## Task 1: SQLite Database Adaptation

**Goal:** Make the backend work with both PostgreSQL (dev) and SQLite (desktop).

**Files:**
- Create: `backend/app/core/types.py`
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/core/database.py`
- Modify: `backend/app/models/reading_session.py`
- Modify: `backend/app/models/passage.py`
- Modify: `backend/app/services/search/engine.py`

- [ ] **Step 1: Create shared SQLiteUUID TypeDecorator**

Create `backend/app/core/types.py`:

```python
"""Database type utilities for cross-dialect compatibility."""

import uuid

from sqlalchemy import CHAR, TypeDecorator
from sqlalchemy.dialects.postgresql import UUID as PG_UUID


class SQLiteUUID(TypeDecorator):
    """Platform-independent UUID type.

    Uses PostgreSQL's native UUID on PostgreSQL,
    and CHAR(36) string storage on other dialects (e.g., SQLite).
    """

    impl = CHAR(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            return str(value)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            return uuid.UUID(value)
        return value


def patch_uuid_columns_for_sqlite(Base):
    """Replace PostgreSQL UUID columns with SQLite-compatible types.

    Call this BEFORE create_all() when using SQLite.
    """
    for table in Base.metadata.tables.values():
        for column in table.columns:
            if isinstance(column.type, PG_UUID):
                column.type = SQLiteUUID()
```

- [ ] **Step 2: Update config.py for SQLite support**

Read `backend/app/core/config.py` and make the following changes:

In the `Settings` class, change the database-related fields:

```python
DATABASE_URL: str = ""  # Override takes priority

# PostgreSQL settings (for dev)
DB_HOST: str = "localhost"
DB_PORT: int = 5432
DB_USER: str = "postgres"
DB_PASSWORD: str = "postgres"
DB_NAME: str = "ebook_library"

# Desktop mode settings
DATA_DIR: str = ""  # Set by --data-dir CLI arg
```

Replace the `get_database_url()` method:

```python
def get_database_url(self) -> str:
    if self.DATABASE_URL:
        return self.DATABASE_URL
    if self.DATA_DIR:
        import os
        db_path = os.path.join(self.DATA_DIR, "data", "ebook.db")
        return f"sqlite:///{db_path}"
    return (
        f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}"
        f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    )
```

Remove or keep `get_async_database_url()` as-is (not used in desktop mode).

Update `BOOK_STORAGE_DIR` and `COVER_CACHE_DIR` defaults:

```python
BOOK_STORAGE_DIR: str = ""
COVER_CACHE_DIR: str = ""
```

Add a method to resolve storage paths based on DATA_DIR:

```python
def get_books_dir(self) -> str:
    if self.BOOK_STORAGE_DIR:
        return self.BOOK_STORAGE_DIR
    if self.DATA_DIR:
        import os
        d = os.path.join(self.DATA_DIR, "books")
        os.makedirs(d, exist_ok=True)
        return d
    return "./books"

def get_covers_dir(self) -> str:
    if self.COVER_CACHE_DIR:
        return self.COVER_CACHE_DIR
    if self.DATA_DIR:
        import os
        d = os.path.join(self.DATA_DIR, "covers")
        os.makedirs(d, exist_ok=True)
        return d
    return "./covers"
```

- [ ] **Step 3: Update database.py for SQLite engine config**

Read `backend/app/core/database.py`. Replace the engine creation:

```python
import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings


def _get_engine_kwargs(url: str) -> dict:
    """Return engine kwargs appropriate for the database dialect."""
    if url.startswith("sqlite"):
        return {
            "connect_args": {"check_same_thread": False},
        }
    return {
        "pool_size": 5,
        "max_overflow": 10,
        "pool_pre_ping": True,
    }


engine = create_engine(
    settings.get_database_url(),
    **_get_engine_kwargs(settings.get_database_url()),
)

# Enable WAL mode for SQLite (better concurrent read performance)
if engine.dialect.name == "sqlite":

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_database():
    """Initialize database tables.

    For SQLite: create data directory and tables.
    For PostgreSQL: tables managed by Alembic.
    """
    if "sqlite" in settings.get_database_url():
        db_path = settings.get_database_url().replace("sqlite:///", "")
        os.makedirs(os.path.dirname(db_path), exist_ok=True)

        # Patch UUID columns for SQLite
        from app.core.types import patch_uuid_columns_for_sqlite
        patch_uuid_columns_for_sqlite(Base)

        # Import all models to register them with Base
        import app.models  # noqa: F401

        Base.metadata.create_all(bind=engine)
```

- [ ] **Step 4: Fix reading_session.py JSON import**

Read `backend/app/models/reading_session.py`. Change:

```python
# FROM:
from sqlalchemy.dialects.postgresql import JSON

# TO:
from sqlalchemy import JSON
```

This ensures JSON columns work on both PostgreSQL and SQLite.

- [ ] **Step 5: Guard pgvector import in passage.py**

Read `backend/app/models/passage.py`. Wrap the pgvector import:

```python
# FROM:
from pgvector.sqlalchemy import Vector

# ... later:
embedding = Column(Vector(1536))

# TO:
import sqlalchemy as sa

# Use pgvector on PostgreSQL, skip on SQLite
try:
    from pgvector.sqlalchemy import Vector
    HAS_PGVECTOR = True
except ImportError:
    HAS_PGVECTOR = False

# In the model class:
embedding = Column(Vector(1536)) if HAS_PGVECTOR else Column(sa.JSON, nullable=True)
```

Note: Since the column definition happens at class body time, use a conditional:

```python
if HAS_PGVECTOR:
    embedding = Column(Vector(1536))
else:
    embedding = Column(sa.JSON, nullable=True)
```

- [ ] **Step 6: Guard vector search in search engine**

Read `backend/app/services/search/engine.py`. Add a dialect check at the top of any function that uses `cosine_distance` or vector operations:

```python
from app.core.database import engine as db_engine

def _is_postgres() -> bool:
    return db_engine.dialect.name == "postgresql"
```

In the search function that uses vector similarity, wrap with:

```python
if not _is_postgres():
    # Fall back to basic text search on SQLite
    # (or return empty results with a message)
    return []
```

Similarly in the indexing function that generates embeddings, guard with `_is_postgres()`.

- [ ] **Step 7: Verify TypeScript/type compilation and tests**

Run: `cd f:/Code/ebook-library/backend && python -m pytest tests/ -q`
Expected: All existing tests still pass (they use SQLite via the existing patching mechanism).

- [ ] **Step 8: Commit**

```bash
cd f:/Code/ebook-library && git add backend/app/core/types.py backend/app/core/config.py backend/app/core/database.py backend/app/models/reading_session.py backend/app/models/passage.py backend/app/services/search/engine.py
git commit -m "feat: add SQLite support for desktop mode"
```

---

## Task 2: Backend CLI Entry Point

**Goal:** Create a CLI entry point that accepts --host, --port, --data-dir and initializes the database.

**Files:**
- Create: `backend/app/core/cli.py`
- Modify: `backend/app/main.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Create CLI entry point**

Create `backend/app/core/cli.py`:

```python
"""CLI entry point for the backend server."""

import argparse
import sys


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Ebook Library Backend Server")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Bind port (default: 8000)")
    parser.add_argument("--data-dir", default="", help="Data directory for SQLite and storage")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)

    # Set data dir in config BEFORE importing app modules
    if args.data_dir:
        import os
        os.environ["DATA_DIR"] = args.data_dir

    from app.core.config import settings
    if args.data_dir:
        settings.DATA_DIR = args.data_dir

    # Initialize database (creates SQLite DB and tables if needed)
    from app.core.database import init_database
    init_database()

    # Start uvicorn
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Update app/main.py to support __main__ execution**

Read `backend/app/main.py`. The health endpoint already exists. No changes needed to the FastAPI app itself. But add a `__main__` block at the end:

```python
# At the end of app/main.py, add:
if __name__ == "__main__":
    from app.core.cli import main
    main()
```

- [ ] **Step 3: Add pyinstaller to requirements.txt**

Read `backend/requirements.txt`. Add at the end:

```
pyinstaller>=6.0
```

- [ ] **Step 4: Test CLI**

Run: `cd f:/Code/ebook-library/backend && python -m app.core.cli --help`
Expected: Shows help text with --host, --port, --data-dir options.

- [ ] **Step 5: Commit**

```bash
cd f:/Code/ebook-library && git add backend/app/core/cli.py backend/app/main.py backend/requirements.txt
git commit -m "feat: add CLI entry point with --data-dir for desktop mode"
```

---

## Task 3: PyInstaller Build Configuration

**Goal:** Create PyInstaller spec file and build scripts for packaging the backend.

**Files:**
- Create: `backend/backend.spec`
- Create: `backend/build.sh`
- Create: `backend/build.bat`

- [ ] **Step 1: Create PyInstaller spec file**

Create `backend/backend.spec`:

```python
# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec file for the ebook-library backend."""

import sys
from pathlib import Path

block_cipher = None

a = Analysis(
    ['app/core/cli.py'],
    pathex=[str(Path('.').resolve())],
    binaries=[],
    datas=[
        ('alembic', 'alembic'),
        ('alembic.ini', '.'),
    ],
    hiddenimports=[
        'uvicorn',
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'sqlalchemy.dialects.sqlite',
        'sqlalchemy.dialects.postgresql',
        'pdfplumber',
        'ebooklib',
        'PIL',
        'openai',
        'anthropic',
        'httpx',
        'chardet',
        'bs4',
        'mobi',
        'docx',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
)
```

- [ ] **Step 2: Create build scripts**

Create `backend/build.sh`:

```bash
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo "Building backend with PyInstaller..."
pyinstaller backend.spec --clean --noconfirm
echo "Build complete: dist/backend"
```

Create `backend/build.bat`:

```bat
@echo off
cd /d "%~dp0"
echo Building backend with PyInstaller...
pyinstaller backend.spec --clean --noconfirm
echo Build complete: dist\backend.exe
```

- [ ] **Step 3: Test PyInstaller build (Windows)**

Run: `cd f:/Code/ebook-library/backend && python -m PyInstaller backend.spec --clean --noconfirm 2>&1 | tail -10`
Expected: Build completes, `dist/backend.exe` exists.

Note: The build may take 1-2 minutes. If it fails due to missing hidden imports, add them to the spec file.

- [ ] **Step 4: Verify the built binary starts**

Run: `cd f:/Code/ebook-library/backend && ./dist/backend.exe --help`
Expected: Shows help text with --host, --port, --data-dir options.

- [ ] **Step 5: Commit**

```bash
cd f:/Code/ebook-library && git add backend/backend.spec backend/build.sh backend/build.bat
git commit -m "feat: add PyInstaller build configuration"
```

---

## Task 4: Electron Main Process — Backend Lifecycle

**Goal:** Electron launches the backend binary on startup and manages its lifecycle.

**Files:**
- Modify: `frontend/electron/main.ts`
- Modify: `frontend/electron/preload.ts`

- [ ] **Step 1: Add IPC handlers to main.ts**

Read `frontend/electron/main.ts`. Add IPC handlers for the existing preload API (dialog:openFile, file:read, window:minimize/maximize/close) and backend lifecycle management.

The full rewritten `frontend/electron/main.ts`:

```typescript
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;

// ── Backend Lifecycle ──

function getBackendPath(): string {
  if (!app.isPackaged) {
    // Dev mode: backend started externally
    return '';
  }
  const ext = process.platform === 'win32' ? '.exe' : '';
  return path.join(process.resourcesPath, 'backend', `backend${ext}`);
}

function waitForHealth(url: string, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      http
        .get(url, (res) => {
          if (res.statusCode === 200) resolve();
          else retry();
        })
        .on('error', retry);
    };
    const retry = () => {
      if (Date.now() - start > timeout) {
        reject(new Error('Backend startup timeout'));
      } else {
        setTimeout(check, 500);
      }
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

// ── Window ──

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1280,
    minHeight: 800,
    titleBarStyle: 'hiddenInset',
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

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── IPC Handlers ──

function registerIpcHandlers() {
  ipcMain.handle('dialog:openFile', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Ebooks', extensions: ['pdf', 'epub', 'txt', 'mobi'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('file:read', async (_event, filePath: string) => {
    try {
      return fs.readFileSync(filePath);
    } catch {
      return null;
    }
  });

  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window:close', () => mainWindow?.close());
}

// ── App Lifecycle ──

app.whenReady().then(async () => {
  registerIpcHandlers();

  try {
    await startBackend();
  } catch (err) {
    console.error('Failed to start backend:', err);
  }

  createWindow();
});

app.on('window-all-closed', () => {
  stopBackend();
  app.quit();
});

app.on('before-quit', () => {
  stopBackend();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```

- [ ] **Step 2: Update preload.ts**

Read `frontend/electron/preload.ts`. Rewrite to use contextBridge properly:

```typescript
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
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd f:/Code/ebook-library && git add frontend/electron/main.ts frontend/electron/preload.ts
git commit -m "feat: add backend lifecycle management to Electron main process"
```

---

## Task 5: Build Configuration (Vite + Electron Builder)

**Goal:** Configure Vite for file:// loading and Electron Builder for packaging.

**Files:**
- Modify: `frontend/vite.config.ts`
- Create: `frontend/electron-builder.yml`
- Modify: `frontend/package.json`

- [ ] **Step 1: Fix vite.config.ts for Electron production loading**

Read `frontend/vite.config.ts`. Add `base: './'` so assets use relative paths (required for `file://` protocol in Electron):

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: './',  // Required for Electron file:// loading
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
});
```

- [ ] **Step 2: Create electron-builder.yml**

Create `frontend/electron-builder.yml`:

```yaml
appId: com.ebook-library.app
productName: 个人图书管理
directories:
  output: release

files:
  - dist/**/*
  - electron/**/*
  - "!node_modules/**/*"

extraResources:
  - from: ../backend/dist/
    to: backend
    filter:
      - "backend*"

win:
  target:
    - target: nsis
      arch:
        - x64
    - target: portable
      arch:
        - x64
  icon: build/icon.ico

mac:
  target:
    - target: dmg
      arch:
        - x64
        - arm64
    - target: zip
      arch:
        - x64
        - arm64
  icon: build/icon.icns

linux:
  target:
    - target: AppImage
      arch:
        - x64
    - target: deb
      arch:
        - x64
  icon: build/icon.png

publish:
  provider: github
  owner: YOUR_GITHUB_USERNAME  # Replace with actual GitHub username before first release
  repo: ebook-library
```

- [ ] **Step 3: Update package.json**

Read `frontend/package.json`. Make these changes:

1. Fix the `main` field (should point to compiled JS):
```json
"main": "electron/main.js"
```

2. Add `electron-updater` dependency:
```bash
cd f:/Code/ebook-library/frontend && npm install electron-updater
```

3. Add platform-specific build scripts to the `scripts` object:
```json
"electron:build:win": "vite build && electron-builder --win --config electron-builder.yml",
"electron:build:mac": "vite build && electron-builder --mac --config electron-builder.yml",
"electron:build:linux": "vite build && electron-builder --linux --config electron-builder.yml"
```

4. Add the `build` key for electron-builder (alternative to yml if needed):
```json
"build": {
  "extends": "electron-builder.yml"
}
```

- [ ] **Step 4: Verify frontend builds**

Run: `cd f:/Code/ebook-library/frontend && npm run build`
Expected: Vite build completes, `dist/` directory created with `index.html` using relative paths.

- [ ] **Step 5: Commit**

```bash
cd f:/Code/ebook-library && git add frontend/vite.config.ts frontend/electron-builder.yml frontend/package.json frontend/package-lock.json
git commit -m "feat: add Electron Builder config and fix Vite for file:// loading"
```

---

## Task 6: Auto-Update

**Goal:** Implement in-app auto-update via electron-updater and GitHub Releases.

**Files:**
- Create: `frontend/electron/updater.ts`
- Create: `frontend/src/components/UpdateModal.tsx`
- Modify: `frontend/electron/main.ts`
- Modify: `frontend/electron/preload.ts`
- Modify: `frontend/src/components/UpdateChecker.tsx`

- [ ] **Step 1: Create updater module**

Create `frontend/electron/updater.ts`:

```typescript
import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';

export function setupAutoUpdater(mainWindow: BrowserWindow) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    mainWindow.webContents.send('update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('update-not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('download-progress', {
      percent: progress.percent,
    });
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update-downloaded');
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
  });

  // IPC handlers
  ipcMain.on('check-for-updates', () => {
    autoUpdater.checkForUpdates();
  });

  ipcMain.on('download-update', () => {
    autoUpdater.downloadUpdate();
  });

  ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall();
  });

  // Check for updates on startup (after a delay)
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 5000);
}
```

- [ ] **Step 2: Integrate updater into main.ts**

In `frontend/electron/main.ts`, import and call `setupAutoUpdater` after the window is created:

```typescript
import { setupAutoUpdater } from './updater';

// In createWindow(), after mainWindow is created:
mainWindow.on('ready-to-show', () => {
  mainWindow?.show();
  if (app.isPackaged) {
    setupAutoUpdater(mainWindow);
  }
});
```

- [ ] **Step 3: Verify preload.ts has update IPC methods**

The `checkForUpdates` and `onDownloadProgress` methods were already added to `frontend/electron/preload.ts` in Task 4. Read the file to verify they exist. No changes needed.

- [ ] **Step 4: Create UpdateModal component**

Create `frontend/src/components/UpdateModal.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Modal, Button, Space, Typography, Progress } from 'antd';

const { Text, Paragraph } = Typography;

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
}

export default function UpdateModal() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;

    api.onUpdateAvailable((info: UpdateInfo) => {
      setUpdateInfo(info);
      setDownloaded(false);
      setDownloading(false);
    });

    api.onUpdateDownloaded(() => {
      setDownloaded(true);
      setDownloading(false);
    });

    api.onDownloadProgress((data: { percent: number }) => {
      setPercent(Math.round(data.percent));
    });
  }, []);

  const handleDownload = () => {
    setDownloading(true);
    (window as any).electronAPI?.downloadUpdate();
  };

  const handleInstall = () => {
    (window as any).electronAPI?.installUpdate();
  };

  if (!updateInfo) return null;

  return (
    <Modal
      title="发现新版本"
      open={!!updateInfo}
      onCancel={() => setUpdateInfo(null)}
      footer={null}
      closable={!downloading}
      maskClosable={!downloading}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text>新版本 v{updateInfo.version} 已发布</Text>
        {updateInfo.releaseNotes && (
          <Paragraph
            ellipsis={{ rows: 3, expandable: true }}
            style={{ maxHeight: 200, overflow: 'auto' }}
          >
            {updateInfo.releaseNotes}
          </Paragraph>
        )}
        {downloading && <Progress percent={percent} status="active" />}
        {downloaded ? (
          <Button type="primary" onClick={handleInstall} block>
            重启并安装更新
          </Button>
        ) : downloading ? (
          <Button disabled block>
            下载中... {percent}%
          </Button>
        ) : (
          <Button type="primary" onClick={handleDownload} block>
            下载更新
          </Button>
        )}
      </Space>
    </Modal>
  );
}
```

- [ ] **Step 5: Integrate UpdateModal into App.tsx**

Read `frontend/src/App.tsx`. Add `UpdateModal` to the app layout:

```tsx
import UpdateModal from './components/UpdateModal';

// Inside the component, before the closing </>:
<UpdateModal />
```

- [ ] **Step 6: Refactor UpdateChecker for Electron**

Read `frontend/src/components/UpdateChecker.tsx`. In the Settings page, the existing UpdateChecker can remain for non-Electron (web) mode. For Electron mode, the `UpdateModal` handles updates automatically. No changes needed to UpdateChecker itself — it already checks the backend endpoint, which is fine for web mode.

- [ ] **Step 7: Verify TypeScript compilation**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
cd f:/Code/ebook-library && git add frontend/electron/updater.ts frontend/electron/main.ts frontend/electron/preload.ts frontend/src/components/UpdateModal.tsx frontend/src/App.tsx
git commit -m "feat: add in-app auto-update via electron-updater"
```

---

## Task 7: GitHub Actions Release Workflow

**Goal:** CI pipeline to build and publish releases on tag push.

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create release workflow**

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - "v*"

permissions:
  contents: write

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: windows-latest
            platform: win
          - os: macos-latest
            platform: mac
          - os: ubuntu-latest
            platform: linux

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      # ── Backend ──
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install backend dependencies
        run: |
          cd backend
          pip install -r requirements.txt

      - name: Build backend with PyInstaller
        run: |
          cd backend
          pyinstaller backend.spec --clean --noconfirm

      # ── Frontend ──
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install frontend dependencies
        run: |
          cd frontend
          npm ci

      - name: Build Electron app
        run: |
          cd frontend
          npm run electron:build:${{ matrix.platform }}

      # ── Publish ──
      - name: Upload release assets
        uses: softprops/action-gh-release@v2
        with:
          files: |
            frontend/release/*.exe
            frontend/release/*.dmg
            frontend/release/*.zip
            frontend/release/*.AppImage
            frontend/release/*.deb
            frontend/release/*.yml
            frontend/release/*.yaml
            frontend/release/*.blockmap
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 2: Verify YAML syntax**

Run: `cd f:/Code/ebook-library && python -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml')); print('Release YAML OK')"`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd f:/Code/ebook-library && git add .github/workflows/release.yml
git commit -m "ci: add GitHub Actions release workflow for desktop packaging"
```

---

## Spec Coverage

| Spec Requirement | Task |
|------------------|------|
| 1. Backend Bundling — PyInstaller | Task 3 |
| 2. Backend Launch Parameters (--data-dir) | Task 2 |
| 3. Health Check Endpoint | Already exists |
| 4. SQLite Configuration | Task 1 |
| 5. SQLAlchemy Compatibility (UUID, pgvector, JSON) | Task 1 |
| 6. Data Directory | Task 1 + Task 2 |
| 7. Electron Backend Lifecycle | Task 4 |
| 8. Electron IPC | Task 4 |
| 9. Vite base config | Task 5 |
| 10. Electron Builder Config | Task 5 |
| 11. Auto-Update (electron-updater) | Task 6 |
| 12. GitHub Actions Release | Task 7 |
