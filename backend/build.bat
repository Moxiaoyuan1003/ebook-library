@echo off
cd /d "%~dp0"
echo Building backend with PyInstaller...
pyinstaller backend.spec --clean --noconfirm
echo Build complete: dist\backend.exe
