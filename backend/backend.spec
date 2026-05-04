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
