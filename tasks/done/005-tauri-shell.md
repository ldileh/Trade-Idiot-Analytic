---
id: 005
title: Tauri v2 shell + spawn backend sidecar
branch: task/005-tauri-shell
status: done
created: 2026-06-25
---

# 005 — Tauri v2 shell + spawn backend sidecar

## Tujuan
Membungkus frontend dalam aplikasi desktop Tauri v2, dan men-spawn backend Python
sebagai sidecar yang otomatis hidup/mati bersama aplikasi.

## Spec / kriteria selesai
- [x] **Prasyarat terpasang**: MSVC C++ Build Tools kini ADA (VS 2019 Community, toolset 14.26, `cl.exe`+`link.exe`+`vcvars64.bat`). Rust di-reinstall via winget → **rustc/cargo 1.96.0 (stable-x86_64-pc-windows-msvc)**. Blocker MSVC lama hilang.
- [x] `src-tauri/` ter-scaffold (Cargo.toml, tauri.conf.json, build.rs, src/main.rs, src/lib.rs, capabilities/default.json).
- [x] `tauri.conf.json` mengonfigurasi `externalBin` (`bin/backend`) + window 1280x800.
- [x] `src-tauri/src/lib.rs`: cari port bebas (`TcpListener :0`), spawn sidecar dgn `BACKEND_PORT`/`BACKEND_HOST`, expose port ke frontend (command `backend_port`), kill sidecar saat window `Destroyed`.
- [x] `tauri dev` menjalankan app desktop — **VERIFIED**: window 'Trade-Idiot-Analytic' terbuka, sidecar listen 127.0.0.1:62178, `/health` ok, `/prices` 124 candles (MSFT); tutup window → 0 backend.exe tersisa.

## Catatan teknis
- **Blocker resolved:** MSVC C++ Build Tools terpasang; `cargo build` me-link via linker MSVC
  (vcvars64 dimuat dulu → `cl.exe`/`link.exe` resolve ke VS 2019, bukan Git's link). Rust sempat
  hilang dari mesin (catatan lama keliru) → di-reinstall 1.96.0 stable-msvc.
- **Bug ditemukan & diperbaiki saat verifikasi:** sidecar PyInstaller one-file menjalankan bootstrap
  yang re-spawn server uvicorn sebagai child. `child.kill()` hanya membunuh bootstrap → child jadi
  orphan dan tetap memegang port. Fix di `lib.rs`: pada `Destroyed`, `taskkill /F /T /PID <pid>`
  (tree-kill) sebelum `child.kill()`. Re-verifikasi: 0 backend.exe tersisa setelah close.
- Frontend siap: `src/api/client.ts` ambil port via command `backend_port` saat di Tauri,
  fallback ke `127.0.0.1:8756` saat browser dev.
- Icons di-generate via `tauri icon` (candlestick hijau/merah) → `src-tauri/icons/icon.ico` dll. ada.
- `src-tauri/target/` & `src-tauri/bin/` sudah di-gitignore.

## Verifikasi
- ✅ `tauri dev` membuka window desktop; sidecar ter-spawn & melayani API di port acak (loopback only).
- ✅ Tutup app → proses sidecar (bootstrap + child) tidak tertinggal (0 backend.exe).
