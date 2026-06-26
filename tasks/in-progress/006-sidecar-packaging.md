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
- [ ] Spec PyInstaller (one-file/one-dir) untuk `backend/main.py` → exe yang jalan tanpa Python terpasang.
- [ ] Pastikan hidden imports/data files yang dibutuhkan (uvicorn, yfinance, ta, backtesting, pandas) ter-include.
- [ ] Exe di-rename sesuai konvensi sidecar Tauri (`*-<target-triple>.exe`) dan ditaruh di `src-tauri/bin/`.
- [ ] `tauri.conf.json` `externalBin` menunjuk sidecar yang benar.
- [ ] `tauri build` menghasilkan app rilis yang menjalankan exe sidecar (bukan venv dev).
- [ ] App rilis: chart + indikator + backtest berfungsi dengan data live.

## Catatan teknis
- Bergantung task 005 (Tauri shell) dan butuh Rust/MSVC (lihat AGENTS.md §7).
- `ta` & `backtesting` murni Python → relatif ramah PyInstaller (alasan menghindari numba).
- Verifikasi exe sidecar bind `127.0.0.1` saja.

## Verifikasi
- Build exe sidecar, jalankan langsung → `/health` OK di port yang diberikan.
- `tauri build`, install/jalankan artefak rilis di mesin tanpa Python dev → app berfungsi penuh.
