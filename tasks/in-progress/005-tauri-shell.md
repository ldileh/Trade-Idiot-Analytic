---
id: 005
title: Tauri v2 shell + spawn backend sidecar
branch: task/005-tauri-shell
status: in-progress
created: 2026-06-25
---

# 005 — Tauri v2 shell + spawn backend sidecar

## Tujuan
Membungkus frontend dalam aplikasi desktop Tauri v2, dan men-spawn backend Python
sebagai sidecar yang otomatis hidup/mati bersama aplikasi.

## Spec / kriteria selesai
- [~] **Prasyarat terpasang**: Rust 1.96 SUDAH terpasang (MSVC toolchain aktif), TAPI **MSVC C++ Build Tools belum** (`cl.exe`/linker MSVC tidak ada → `cargo build` gagal di tahap link). Tertunda karena kendala admin user.
- [x] `src-tauri/` ter-scaffold (Cargo.toml, tauri.conf.json, build.rs, src/main.rs, src/lib.rs, capabilities/default.json).
- [x] `tauri.conf.json` mengonfigurasi `externalBin` (`binaries/backend`) + window 1280x800.
- [x] `src-tauri/src/lib.rs`: cari port bebas (`TcpListener :0`), spawn sidecar dgn `BACKEND_PORT`/`BACKEND_HOST`, expose port ke frontend (command `backend_port`), kill sidecar saat window `Destroyed`.
- [ ] `tauri dev` menjalankan app desktop — **TERTUNDA**: butuh MSVC C++ Build Tools agar `cargo build` bisa link.

## Catatan teknis
- **Status blocker (diperbarui):** Rust ada; yang kurang hanya **MSVC C++ Build Tools**.
  `cargo check` berhasil resolve 441 deps & parse manifest, lalu gagal di link build-script
  (`serde_json`/`anyhow`/dll) karena `link.exe` yang ke-resolve adalah Git's link, bukan linker MSVC.
  Kode Rust (`lib.rs`) sendiri valid — error murni dari toolchain, bukan kode.
- Frontend siap: `src/api/client.ts` ambil port via command `backend_port` saat di Tauri,
  fallback ke `127.0.0.1:8756` saat browser dev.
- Untuk dev, sidecar bisa berupa venv python; untuk release pakai exe PyInstaller (task 006).
- **Belum ada** `src-tauri/icons/icon.ico` — perlu sebelum `tauri build` (urusan release / task 006).
- `src-tauri/target/` & `src-tauri/bin/` sudah di-gitignore.

## Verifikasi
- `tauri dev` membuka window; chart & backtest berfungsi karena backend ter-spawn.
- Tutup app → proses sidecar python tidak tertinggal (cek task manager).
