---
id: 009
title: Layout 2 kolom (form di samping), chart lebih besar, popup backtest diperbesar
branch: task/009-layout-2-kolom
status: done
created: 2026-06-28
---

# 009 — Revisi layout: 2 kolom + chart lebih jelas

## Tujuan
Tindak lanjut feedback task 008: form pilih saham dipindah ke samping (jadi 2 kolom),
grafik dibuat lebih besar/jelas, dan popup uji strategi diperbesar.

## Spec / kriteria selesai
- [x] **Layout 2 kolom**: kolom kiri = form pilih saham + ringkasan harga (sticky);
  kolom kanan = grafik utama. Menyusut jadi 1 kolom di layar sempit (<900px).
- [x] **Chart lebih besar**: tinggi grafik responsif `clamp(440px, calc(100vh - 230px), 860px)`,
  lebar app dinaikkan ke 1400px supaya grafik tetap lega di sebelah sidebar.
- [x] **Popup uji strategi diperbesar**: lebar modal tengah 720px → 980px.
- [x] Build lolos: `pnpm build` (tsc + vite).

## Verifikasi
- `pnpm build` sukses.
