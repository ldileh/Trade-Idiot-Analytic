---
id: 007
title: Rombak UI jadi menarik, interaktif & ramah pemula
branch: task/007-ui-ramah-pemula
status: in-progress
created: 2026-06-28
---

# 007 — Rombak UI jadi menarik, interaktif & ramah pemula

## Tujuan
Tampilan lama terlalu polos & penuh jargon. Buat UI lebih menarik dan interaktif,
dengan fokus utama: **mudah dipahami trader pemula** — setiap komponen, istilah, dan
informasi dijelaskan pakai bahasa sederhana ("bahasa bayi"), bukan istilah teknis mentah.

## Spec / kriteria selesai
- [x] Sistem desain global (`src/styles.css`): tema, kartu, tombol, chip, tooltip — menggantikan inline-style polos.
- [x] Kamus penjelasan terpusat (`src/help.ts`): indikator, interval, range, strategi, dan statistik backtest punya label + penjelasan Bahasa Indonesia sederhana.
- [x] Komponen bantu: tooltip info ("?") yang bisa di-hover untuk penjelasan singkat.
- [x] Alur dibuat bertahap **Langkah 1–3** (pilih saham → tambah indikator → uji strategi) biar tidak membingungkan.
- [x] **Pilih saham** ramah: label awam (kode saham, "1 batang = berapa lama", "lihat ke belakang berapa lama") + quick-pick saham populer.
- [x] **Ringkasan harga** interaktif: harga terakhir, naik/turun (warna hijau/merah), tertinggi/terendah periode — bahasa awam.
- [x] **Indikator** sebagai kartu pilih (toggle) dengan emoji + penjelasan satu kalimat + tooltip.
- [x] **Chart** di-theme (lilin hijau/merah jelas) + legenda penjelasan ("lilin hijau = harga naik").
- [x] **Backtest**: pilih strategi sebagai kartu berpenjelasan; hasil "diterjemahkan" — tiap angka diberi label awam, penjelasan, warna baik/buruk, dan satu kalimat kesimpulan (menang/kalah lawan beli-diamkan).
- [x] Build lolos: `pnpm build` (tsc + vite) sukses, tidak ada error TypeScript.

## Catatan teknis
- Tanpa Tailwind — pakai satu file CSS + className. Logika data (fetch/effect) tidak diubah, hanya presentasi.
- Komentar kode tetap Bahasa Inggris; teks UI Bahasa Indonesia sederhana.
- Statistik backtest yang dikembalikan backend: Return [%], Buy & Hold Return [%], Return (Ann.) [%],
  Volatility (Ann.) [%], Sharpe, Sortino, Max. Drawdown [%], Win Rate [%], # Trades, Profit Factor, Expectancy [%].

## Verifikasi
- `pnpm build` sukses.
- Jalankan `pnpm dev` (atau `tauri dev`) → cek alur 3 langkah, tooltip muncul, indikator & backtest tampil dengan penjelasan, chart ter-theme.
