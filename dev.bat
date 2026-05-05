@echo off
echo ========================================
echo   Starting ebook-library dev mode
echo ========================================
echo.

set DATA_DIR=%LOCALAPPDATA%\ebook-library

echo [1/2] Starting backend (data: %DATA_DIR%)...
cd /d "%~dp0backend"
start "Backend" cmd /k ".venv\Scripts\python.exe -m app.main --data-dir %DATA_DIR%"

echo [2/2] Starting frontend + Electron...
cd /d "%~dp0frontend"
set ELECTRON_RUN_AS_NODE=
npm run electron:dev
