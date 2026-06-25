---
id: 005
title: Tauri v2 shell + spawn backend sidecar
branch: task/005-tauri-shell
status: backlog
created: 2026-06-25
---

# 005 — Tauri v2 shell + spawn backend sidecar

## Tujuan
Membungkus frontend dalam aplikasi desktop Tauri v2, dan men-spawn backend Python
sebagai sidecar yang otomatis hidup/mati bersama aplikasi.

## Spec / kriteria selesai
- [ ] **Prasyarat terpasang**: Rust toolchain + (MSVC atau GNU) build tools. Lihat blocker AGENTS.md §7 — keputusan toolchain harus diputuskan user dulu.
- [ ] `src-tauri/` ter-scaffold (Cargo.toml, tauri.conf.json, build.rs, src/main.rs, src/lib.rs).
- [ ] `tauri.conf.json` mengonfigurasi `externalBin` (sidecar) + window.
- [ ] `src-tauri/src/lib.rs`: cari port bebas, spawn sidecar dengan `BACKEND_PORT`, sampaikan port ke frontend, kill sidecar saat app keluar.
- [ ] `tauri dev` menjalankan app desktop dengan frontend + backend menyala bersama.

## Catatan teknis
- **Terblokir** sampai keputusan MSVC vs GNU (AGENTS.md §7). Backend & task 001-004 tidak butuh ini.
- Untuk dev, sidecar bisa berupa venv python; untuk release pakai exe PyInstaller (task 006).
- `src-tauri/target/` & `src-tauri/bin/` sudah di-gitignore.

## Verifikasi
- `tauri dev` membuka window; chart & backtest berfungsi karena backend ter-spawn.
- Tutup app → proses sidecar python tidak tertinggal (cek task manager).
