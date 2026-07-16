---
id: 020
title: Saham yang Gerak Bareng (korelasi)
branch: task/020-korelasi-saham
status: in-progress
created: 2026-07-16
---

# 020 — Saham yang Gerak Bareng (korelasi)

## Tujuan
Memberi konteks di halaman simbol/posisi: saham lain yang biasanya naik-turun bersamaan
("Saham yang Gerak Bareng"), agar terlihat apakah sebuah saham bergerak bersama
sektornya atau independen.

## Spec / kriteria selesai
- [x] Backend (`correlation.py` + /correlation) menghitung korelasi Pearson return
      harian 6 bulan antara simbol aktif dan kandidat (sektor + watchlist) dari OHLCV
      ter-cache — tanpa API tambahan.
- [x] UI (CorrelationPanel di drawer Pola) menampilkan N saham paling searah & paling
      berlawanan + kekuatan dalam kata (Kuat/Sedang/Lemah), bukan angka mentah.
- [x] Label & tip Bahasa Indonesia "Saham lain yang biasanya naik-turun bersamaan"
      ([PLAN.md](../../PLAN.md) §3).
- [x] Data kurang (overlap < ~2 bulan) → `enough_data=false` → "Belum cukup data".

## Catatan teknis
- Bergantung pada task 013 (cache OHLCV lokal).
- Korelasi Pearson antar kolom return via pandas `DataFrame.corr()` — sudah tersedia,
  tanpa dependency baru.
- Kandidat pembanding: anggota sektor dari `src/sectors.ts` + `WATCHLIST_BY_MARKET`
  di `src/recommendations.ts`.

## Verifikasi
- Uji pasangan yang jelas segerombol (mis. bank IDX: BBCA/BBRI/BMRI) → korelasi tinggi;
  pasangan beda industri → lebih rendah.
- Simbol dengan riwayat pendek → "belum cukup data", tanpa error.
