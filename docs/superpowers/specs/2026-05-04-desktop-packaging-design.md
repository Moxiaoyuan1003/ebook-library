# Desktop Packaging & Release Design

> Document status: Draft | Date: 2026-05-04 | Version: v1.0

---

## Overview

Package the Electron + React + FastAPI ebook library as a distributable desktop application. The backend (Python) is bundled via PyInstaller, the database switches from PostgreSQL to SQLite for zero-config desktop use, and auto-update delivers new versions via GitHub Releases.

**Key decisions:**
- Backend bundling: PyInstaller (single binary)
- Database: SQLite for desktop (PostgreSQL for dev)
- Platforms: Windows + macOS + Linux
- Auto-update: electron-updater + GitHub Releases

---

## 1. Backend Bundling — PyInstaller

### 1.1 PyInstaller Spec

Create `backend/build.spec` (or run via CLI):

- **Entry point:** `backend/app/main.py` (uvicorn launch)
- **Mode:** `--onefile` — single executable
- **Hidden imports:** `uvicorn`, `uvicorn.logging`, `uvicorn.loops`, `uvicorn.protocols`, `sqlalchemy.dialects.sqlite`, `pdfplumber`, `ebooklib`, `PIL`, `openai`, `anthropic`, `httpx`
- **Data files:** `backend/alembic/` → bundled for runtime migrations
- **Platform note:** `--add-data` separator is `;` on Windows and `:` on macOS/Linux. Use PyInstaller spec file (`.spec`) for cross-platform compatibility instead of CLI args.
- **Output:**
  - Windows: `backend/dist/backend.exe`
  - macOS: `backend/dist/backend`
  - Linux: `backend/dist/backend`

### 1.2 Backend Launch Parameters

```
backend --host 127.0.0.1 --port 8000 --data-dir <userData>
```

- `--host` / `--port`: Bind address (default 127.0.0.1:8000)
- `--data-dir`: Root directory for runtime data (SQLite DB, uploaded books, covers). Passed by Electron from `app.getPath('userData')`

The backend creates subdirectories:
- `<data-dir>/data/ebook.db` — SQLite database
- `<data-dir>/books/` — uploaded ebook files
- `<data-dir>/covers/` — cover images

### 1.3 Health Check Endpoint

Add `GET /api/health` to backend (if not existing):

```python
@router.get("/health")
async def health():
    return {"status": "ok"}
```

Electron polls this before loading the frontend.

---

## 2. Database Adaptation — SQLite Support

### 2.1 Configuration

In `app/core/config.py`, change the default:

```python
DATABASE_URL: str = "sqlite:///./data/ebook.db"
```

- Desktop: uses SQLite (default, no env var needed)
- Development: set `DATABASE_URL=postgresql://...` in `.env`
- The `--data-dir` parameter adjusts the SQLite path to `<data-dir>/data/ebook.db`

### 2.2 SQLAlchemy Compatibility

Current code uses SQLAlchemy ORM, which abstracts most dialect differences. Changes needed:

- **UUID columns:** Desktop SQLite uses `CHAR(36)` for UUIDs. Reuse the `SQLiteUUID` TypeDecorator pattern already in tests — promote it to a shared utility in `app/core/types.py`. Apply it at model definition level or via event listener.
- **pgvector:** The `pgvector` extension is PostgreSQL-only. Wrap vector operations in a dialect check:
  ```python
  if engine.dialect.name == "postgresql":
      # use pgvector for similarity search
  else:
      # skip or use SQLite FTS5 for text search
  ```
- **JSONB → JSON:** SQLAlchemy's `JSON` type works on both. If models use `JSONB`, change to `JSON` (or use `JSON().with_variant(JSONB, "postgresql")`).
- **String functions:** `func.similarity()` (pg_trgm) is PostgreSQL-only. Guard with dialect check.

### 2.3 Alembic Migrations

- Detect dialect at runtime; skip PostgreSQL-specific operations (e.g., `CREATE EXTENSION`) when running on SQLite
- On desktop first launch, run `alembic upgrade head` automatically before starting the server
- Add an init function in `app/core/database.py`:

```python
def init_database(data_dir: str):
    """Create tables and run migrations for desktop mode."""
    if "sqlite" in settings.DATABASE_URL:
        os.makedirs(os.path.dirname(settings.DATABASE_URL.replace("sqlite:///", "")), exist_ok=True)
    # Run alembic upgrade head programmatically
```

### 2.4 Data Directory

Electron passes `app.getPath('userData')` to the backend. The backend resolves:
- `DATABASE_URL` → `sqlite:///<data-dir>/data/ebook.db`
- `BOOKS_DIR` → `<data-dir>/books/`
- `COVERS_DIR` → `<data-dir>/covers/`

---

## 3. Electron Main Process Changes

### 3.1 Backend Lifecycle Management

Modify `frontend/electron/main.ts`:

```typescript
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { app } from 'electron';
import http from 'http';

let backendProcess: ChildProcess | null = null;

function getBackendPath(): string {
  const isDev = !app.isPackaged;
  if (isDev) return 'python'; // dev: assume backend runs separately
  return path.join(process.resourcesPath, 'backend', 'backend');
}

async function startBackend(): Promise<void> {
  if (!app.isPackaged) return; // dev mode: backend started externally

  const backendPath = getBackendPath();
  const dataDir = app.getPath('userData');

  backendProcess = spawn(backendPath, [
    '--host', '127.0.0.1',
    '--port', '8000',
    '--data-dir', dataDir,
  ], { stdio: 'pipe' });

  // Wait for health check
  await waitForHealth('http://127.0.0.1:8000/api/health', 30000);
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

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
});
```

### 3.2 Window Configuration

- `loadURL`: In dev → `http://localhost:5173`, in prod → `file://dist/index.html`
- Keep existing `contextIsolation: true`, `nodeIntegration: false`
- Add `webPreferences.preload` pointing to bundled preload script

### 3.3 IPC for Backend Info

Expose to renderer via preload:
- `getBackendUrl()` → `http://127.0.0.1:8000`
- `getDataPath()` → `app.getPath('userData')`

---

## 4. Build Pipeline

### 4.1 Electron Builder Configuration

Create `frontend/electron-builder.yml`:

```yaml
appId: com.ebook-library.app
productName: 个人图书管理
directories:
  output: release
files:
  - dist/**/*
  - electron/**/*
extraResources:
  - from: ../backend/dist/
    to: backend
    filter:
      - "backend*"
win:
  target:
    - target: nsis
      arch: [x64]
    - target: portable
      arch: [x64]
  icon: build/icon.ico
mac:
  target:
    - target: dmg
      arch: [x64, arm64]
    - target: zip
      arch: [x64, arm64]
  icon: build/icon.icns
linux:
  target:
    - target: AppImage
      arch: [x64]
    - target: deb
      arch: [x64]
  icon: build/icon.png
publish:
  provider: github
  owner: <github-username>
  repo: ebook-library
```

### 4.2 Build Scripts

Add to `frontend/package.json`:

```json
{
  "scripts": {
    "electron:build": "vite build && electron-builder --config electron-builder.yml",
    "electron:build:win": "vite build && electron-builder --win --config electron-builder.yml",
    "electron:build:mac": "vite build && electron-builder --mac --config electron-builder.yml",
    "electron:build:linux": "vite build && electron-builder --linux --config electron-builder.yml"
  }
}
```

Add `backend/build.sh` / `backend/build.bat`:

```bash
# backend/build.sh
cd "$(dirname "$0")"
pyinstaller backend.spec
```

```bat
@REM backend/build.bat
cd /d "%~dp0"
pyinstaller backend.spec
```

The `.spec` file handles all platform-specific details (hidden imports, data files, output naming).

### 4.3 Full Build Flow

```
1. cd backend && ./build.sh        → backend/dist/backend
2. cd frontend && npm run electron:build  → frontend/release/
   - vite build → frontend/dist/
   - electron-builder → packages backend + frontend into installer
```

---

## 5. Auto-Update

### 5.1 electron-updater Setup

Install: `npm install electron-updater`

In `frontend/electron/main.ts`:

```typescript
import { autoUpdater } from 'electron-updater';

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Check for updates after window is ready
win.webContents.on('did-finish-load', () => {
  autoUpdater.checkForUpdates();
});

autoUpdater.on('update-available', (info) => {
  win.webContents.send('update-available', info);
});

autoUpdater.on('update-downloaded', () => {
  win.webContents.send('update-downloaded');
});
```

### 5.2 Renderer Update UI

In the frontend, listen for update events and show a notification:
- "发现新版本 v1.2.0，是否下载？" → confirm → `autoUpdater.downloadUpdate()`
- "更新已下载，重启应用以完成更新" → `autoUpdater.quitAndInstall()`

### 5.3 Preload IPC

Add to preload:
```typescript
ipcRenderer.on('update-available', callback)
ipcRenderer.on('update-downloaded', callback)
ipcRenderer.send('download-update')
ipcRenderer.send('install-update')
```

### 5.4 Code Signing

- **macOS:** Requires Apple Developer certificate. Set `CSC_LINK` and `CSC_KEY_PASSWORD` in CI secrets. Without signing, auto-update won't work on macOS (Gatekeeper blocks unsigned apps).
- **Windows:** Optional but recommended. Set `CSC_LINK` and `CSC_KEY_PASSWORD` for EV/OV certificate. Unsigned apps show SmartScreen warnings.
- **Linux:** No signing required.

---

## 6. GitHub Actions Release Workflow

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags: ['v*']

jobs:
  release:
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4

      # Backend
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -r backend/requirements.txt pyinstaller
      - run: cd backend && pyinstaller backend.spec

      # Frontend
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd frontend && npm ci
      - run: cd frontend && npm run electron:build

      # Publish
      - uses: softprops/action-gh-release@v2
        with:
          files: frontend/release/*
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## File Change Summary

### New Files

| File | Responsibility |
|------|---------------|
| `backend/build.spec` | PyInstaller spec file |
| `backend/build.sh` | Backend build script (Unix) |
| `backend/build.bat` | Backend build script (Windows) |
| `backend/app/core/types.py` | SQLiteUUID TypeDecorator (shared) |
| `frontend/electron-builder.yml` | Electron Builder config |
| `frontend/electron/updater.ts` | Auto-update logic |
| `.github/workflows/release.yml` | Release CI pipeline |

### Modified Files

| File | Changes |
|------|---------|
| `frontend/electron/main.ts` | Backend lifecycle management, health check |
| `frontend/electron/preload.ts` | Expose update IPC, backend URL |
| `frontend/package.json` | Add electron-updater, build scripts |
| `backend/app/core/config.py` | SQLite default, data-dir parameter |
| `backend/app/core/database.py` | SQLite engine setup, init_database() |
| `backend/app/main.py` | CLI args (--data-dir, --host, --port) |
| `backend/app/models/` | UUID/JSONB type compatibility |
| `backend/app/services/` | pgvector guard for SQLite |
| `backend/requirements.txt` | Add pyinstaller |

---

## Spec Self-Review

1. **Placeholder scan:** No TBDs. ✅
2. **Internal consistency:** Architecture matches feature descriptions. ✅
3. **Scope check:** Large but cohesive — one spec covers the full packaging pipeline. Tasks can be decomposed into: (1) SQLite adaptation, (2) PyInstaller, (3) Electron changes, (4) build config, (5) auto-update, (6) CI. ✅
4. **Ambiguity check:** Each section has concrete config/code. ✅
