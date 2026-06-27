---
id: 006
title: Package backend sebagai sidecar (PyInstaller) + build rilis
branch: task/006-sidecar-packaging
status: done
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
- [x] `tauri.conf.json` `externalBin: ["bin/backend"]` → resolve ke nama bertriple di atas. **(Fix: semula `binaries/backend` salah path — Tauri mencari di `src-tauri/binaries/`, padahal exe ada di `src-tauri/bin/`.)**
- [x] `tauri build` menghasilkan app rilis — **VERIFIED**: MSI `Trade-Idiot-Analytic_0.1.0_x64_en-US.msi` (77 MB) + NSIS `Trade-Idiot-Analytic_0.1.0_x64-setup.exe` (76 MB). Sidecar `backend.exe` (74 MB) terbundle di samping binary.
- [x] App rilis end-to-end — **VERIFIED**: jalankan `target/release/trade-idiot-analytic.exe` → sidecar listen 127.0.0.1:51180 (loopback only), `/health` ok, `/prices` 251 candles (AAPL), `/indicators` ema_20 ok; tutup window → 0 backend.exe tersisa.

## Catatan teknis
- **SELESAI penuh.** Bagian PyInstaller (1-4) + `tauri build` (5-6) semuanya terverifikasi.
- **Bug path externalBin diperbaiki**: `binaries/backend` → `bin/backend` (selaras `build_sidecar.py`
  & `.gitignore`). Tak pernah ketahuan sebelumnya karena `tauri build` belum pernah jalan (blocker MSVC).
- **Bug orphan sidecar** (one-file bootstrap → child) diperbaiki di `lib.rs` (tree-kill) — lihat task 005.
- `ta` & `backtesting` murni Python → relatif ramah PyInstaller (alasan menghindari numba).
- **Verifikasi exe standalone (port 8799, dulu)**: `/health` OK, /prices 124 candles, /indicators EMA_20,
  /backtest Return -17.67%/6 trades/251 pts. Bind **127.0.0.1 saja**. ✅

## Verifikasi
- ✅ Build exe sidecar, jalankan langsung → `/health` OK di port yang diberikan.
- ✅ `tauri build` → MSI + NSIS terbentuk; jalankan binary rilis (sidecar terbundle, tanpa Python dev) → app berfungsi penuh, API loopback OK, tanpa orphan.
