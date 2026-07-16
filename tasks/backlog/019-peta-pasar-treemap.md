---
id: 019
title: Peta Pasar (treemap) — favorit & sektor IDX
branch: task/019-peta-pasar-treemap
status: backlog
created: 2026-07-16
---

# 019 — Peta Pasar (treemap)

## Tujuan
Menampilkan "Peta Pasar": treemap dengan ukuran kotak = market cap dan warna =
performa (hijau naik, merah turun), untuk melihat sekilas apa yang naik/turun di daftar
favorit atau satu sektor IDX.

## Spec / kriteria selesai
- [ ] Komponen `MarketMapPanel` menampilkan treemap untuk (a) daftar favorit user dan
      (b) sektor dari `src/sectors.ts`.
- [ ] Ukuran kotak proporsional market cap; warna gradasi merah→hijau berdasar perubahan
      harga (harian, dari OHLCV ter-cache).
- [ ] Klik kotak → membuka simbol itu di chart utama.
- [ ] Label & legenda Bahasa Indonesia: "Kotak besar = perusahaan besar, hijau = naik,
      merah = turun" (tabel [PLAN.md](../../PLAN.md) §3).
- [ ] Data market cap & perubahan diambil sekali per refresh (batch), bukan per kotak.

## Catatan teknis
- Bergantung pada task 013 (harga dari cache; market cap dari fundamentals yang sudah ada).
- Layout treemap squarified bisa ditulis tangan (±50 baris) atau render langsung dengan
  div CSS — jangan tambah library chart baru; `lightweight-charts` tidak punya treemap.
- Pola panel: ikuti `RRGPanel.tsx` (panel mapping yang sudah ada).

## Verifikasi
- Buka Peta Pasar untuk favorit + satu sektor IDX: proporsi kotak masuk akal (saham
  market cap besar dominan), warna cocok dengan perubahan harga hari itu.
- Klik kotak → chart pindah ke simbol tersebut.
