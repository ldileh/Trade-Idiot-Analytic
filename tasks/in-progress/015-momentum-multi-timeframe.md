---
id: 015
title: Kekuatan Tren multi-timeframe (1/3/6 bulan)
branch: task/015-momentum-multi-timeframe
status: in-progress
created: 2026-07-16
---

# 015 — Kekuatan Tren multi-timeframe (1/3/6 bulan)

## Tujuan
Menampilkan momentum sebagai tiga angka terpisah (1/3/6 bulan) — "Kekuatan Tren" — agar
terlihat apakah tren baru mulai atau sudah lama, alih-alih satu pembacaan RSI/Stochastic
tunggal. Dasar: riset momentum Jegadeesh & Titman.

## Spec / kriteria selesai
- [x] Backend menghitung return/momentum periode formasi 1, 3, 6 bulan dari OHLCV
      ter-cache (task 013) — tanpa panggilan API tambahan (endpoint /momentum, 1y daily cache).
- [x] Konfirmasi tren menyertakan volume (OBV → "Minat Beli"), bukan MA crossover sendirian;
      caveat sinyal palsu bila volume tidak mendukung sesuai [PLAN.md](../../PLAN.md) §2.
- [x] UI menampilkan "Kekuatan Tren: 1 Bulan / 3 Bulan / 6 Bulan" (tiga angka + arah)
      di halaman simbol (MomentumPanel di drawer Pola).
- [x] Label & tip Bahasa Indonesia sesuai tabel [PLAN.md](../../PLAN.md) §3.

## Catatan teknis
- Bergantung pada task 013 (cache OHLCV lokal).
- Perhitungan sederhana (return kumulatif per periode + peringkat) — tidak perlu library
  baru; OBV/VWAP bisa dari `ta` yang sudah terpasang.
- Tempat tampil: dekat `PriceSummary`/`PatternPanel` di halaman simbol (putuskan saat
  implementasi, ikuti pola panel yang ada).

## Verifikasi
- Bandingkan angka 1/3/6 bulan untuk 2-3 ticker terhadap hitungan manual dari data
  harga yang sama.
- Saham yang jelas uptrend panjang (mis. cek chart) menunjukkan ketiga angka positif;
  saham yang baru rebound hanya positif di 1 bulan.
