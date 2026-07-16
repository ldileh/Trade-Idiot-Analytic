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
- [ ] Backend menghitung korelasi return harian (mis. 6 bulan terakhir) antara simbol
      aktif dan anggota sektornya / watchlist, dari OHLCV ter-cache — tanpa panggilan
      API tambahan.
- [ ] UI di halaman simbol menampilkan daftar ringkas: N saham paling searah (dan paling
      berlawanan) + kekuatan hubungannya dalam kata (Kuat/Sedang/Lemah), bukan angka
      korelasi mentah.
- [ ] Label & tip Bahasa Indonesia sesuai tabel [PLAN.md](../../PLAN.md) §3
      ("Saham lain yang biasanya naik-turun bersamaan").
- [ ] Data kurang (saham baru listing / cache kosong) → tampil "belum cukup data".

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
