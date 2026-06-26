---
id: 006
title: Package backend sebagai sidecar (PyInstaller) + build rilis
branch: task/006-sidecar-packaging
status: in-progress
created: 2026-06-25
---

# 006 — Package backend sebagai sidecar (PyInstaller) + build rilis

## Tujuan
Mem-bundle backend FastAPI menjadi satu executable mandiri via PyInstaller, taruh
sebagai sidecar Tauri, dan menghasilkan installer/app rilis lewat `tauri build`.

## Spec / kriteria selesai
- [x] Spec PyInstaller (`backend/sidecar.spec`, one-file) untuk `backend/main.py` → exe (75 MB) jalan tanpa Python terpasang.
- [x] Hidden imports/data files (uvicorn, yfinance, ta, backtesting, pandas) ter-include via `collect_all` + impl uvicorn eksplisit.
- [x] Exe di-rename `backend-x86_64-pc-windows-msvc.exe` (konvensi sidecar Tauri) ditaruh di `src-tauri/bin/` (gitignored). Helper: `backend/build_sidecar.py`.
- [x] `tauri.conf.json` `externalBin: ["binaries/backend"]` → resolve ke nama bertriple di atas.
- [ ] `tauri build` menghasilkan app rilis — **TERTUNDA**: butuh MSVC C++ Build Tools (sama blocker task 005).
- [ ] App rilis end-to-end — **TERTUNDA**: menunggu `tauri build`.

## Catatan teknis
- **Setengah jalan**: bagian PyInstaller (kriteria 1-4) SELESAI & terverifikasi penuh tanpa MSVC.
  Bagian `tauri build` (5-6) tertunda MSVC, sama seperti task 005.
- `ta` & `backtesting` murni Python → relatif ramah PyInstaller (alasan menghindari numba).
- **Verifikasi exe standalone (port 8799)**: `/health` OK, /prices 124 candles, /indicators EMA_20,
  /backtest Return -17.67%/6 trades/251 pts. Bind **127.0.0.1 saja** (dicek via Get-NetTCPConnection). ✅

## Verifikasi
- Build exe sidecar, jalankan langsung → `/health` OK di port yang diberikan.
- `tauri build`, install/jalankan artefak rilis di mesin tanpa Python dev → app berfungsi penuh.
