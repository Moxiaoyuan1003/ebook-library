#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo "Building backend with PyInstaller..."
pyinstaller backend.spec --clean --noconfirm
echo "Build complete: dist/backend"
