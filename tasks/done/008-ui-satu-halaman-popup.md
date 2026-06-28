---
id: 008
title: UI satu halaman (chart-centric) + popup, dropdown saham, fix interval×range
branch: task/008-ui-satu-halaman-popup
status: done
created: 2026-06-28
---

# 008 — UI satu halaman, popup, dropdown saham, perjelas backtest

## Tujuan
Tindak lanjut feedback task 007: tampilan dijadikan satu halaman berpusat pada grafik,
istilah (terutama backtest) dibuat lebih mudah dipahami, dan pemilihan saham/rentang
waktu dipermudah sekaligus memperbaiki error kombinasi interval menit + rentang panjang.

## Spec / kriteria selesai
- [x] **Satu halaman chart-centric**: form pilih saham di atas, grafik jadi tampilan utama;
  alat bantu & uji strategi muncul sebagai popup, bukan kartu langkah yang ditumpuk.
- [x] **Popup**: komponen `Modal` (varian tengah & drawer kanan). Indikator = drawer kanan
  (grafik tetap terlihat saat menyalakan/mematikan), backtest = dialog tengah.
- [x] **Dropdown saham yang bisa dicari**: ketik nama (mis. "Apple") atau kode (mis. "AAPL"),
  pilih dari daftar kurasi (`src/stocks.ts`); tetap menerima kode kustom.
- [x] **Fix interval×rentang**: tambah rentang pendek `1d`/`5d` (backend + frontend);
  pilihan "lihat ke belakang" otomatis dibatasi sesuai interval (`ALLOWED_RANGES`),
  sehingga kombinasi seperti 15m + 1 tahun (yang tadinya 404) tidak bisa dipilih.
- [x] **Backtest lebih jelas**: tiap strategi punya kotak "cara kerja / patokan" —
  RSI dijelaskan sebagai angka meteran 0–100 (batas kemurahan/kemahalan = angka RSI,
  bukan harga); garis cepat/lambat dijelaskan sebagai rata-rata harga penutupan
  sedikit vs banyak hari, beserta aturan beli/jualnya.
- [x] Build lolos: `pnpm build` (tsc + vite) sukses.

## Verifikasi
- `pnpm build` sukses.
- Backend diuji: `15m+1mo`, `15m+5d`, `1m+5d`, `1h+6mo` → dapat data;
  `15m+1y` → 404 (kombinasi yang kini diblokir di UI); `1d+1y` → data.
