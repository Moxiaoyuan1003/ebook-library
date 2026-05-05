@echo off
echo ========================================
echo   Building ebook-library for Windows
echo ========================================
cd /d "%~dp0frontend"
set CSC_IDENTITY_AUTO_DISCOVERY=false
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
call npm run electron:build:win
echo.
echo ========================================
if %errorlevel%==0 (
  echo   Build SUCCESS! Check frontend\release\
) else (
  echo   Build FAILED with error code %errorlevel%
)
echo ========================================
pause
