# PyInstaller spec for the Tauri backend sidecar.
#
# Builds backend/main.py into a single self-contained exe that runs without a
# system Python. Tauri launches it and passes BACKEND_PORT/BACKEND_HOST via env.
#
# Build:  backend/.venv/Scripts/pyinstaller backend/sidecar.spec
# Output: backend/dist/backend.exe  (rename to *-<target-triple>.exe for Tauri)
#
# uvicorn picks its protocol/lifespan impls by string at runtime, and
# yfinance/ta/backtesting/pandas pull data files + lazy submodules — so collect
# them wholesale instead of guessing every hidden import.
from PyInstaller.utils.hooks import collect_all

datas, binaries, hiddenimports = [], [], []
# `requests` (+ certifi CA bundle) is used directly to download KSEI ownership
# ZIPs; collect it wholesale so the cert bundle ships with the sidecar.
for pkg in ("uvicorn", "yfinance", "ta", "backtesting", "pandas", "requests", "certifi"):
    d, b, h = collect_all(pkg)
    datas += d
    binaries += b
    hiddenimports += h

# uvicorn's auto-selected impls aren't import-visible from its package alone.
hiddenimports += [
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.websockets.websockets_impl",
    "uvicorn.lifespan.on",
    "uvicorn.loops.asyncio",
]

a = Analysis(
    ["main.py"],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib"],  # not used; trims size
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,  # sidecar; Tauri hides the window. Logs go to stdout/stderr.
    target_arch=None,
)
