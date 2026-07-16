---
id: 019
title: Peta Pasar (treemap) — favorit & sektor IDX
branch: task/019-peta-pasar-treemap
status: in-progress
created: 2026-07-16
---

# 019 — Peta Pasar (treemap)

## Tujuan
Menampilkan "Peta Pasar": treemap dengan ukuran kotak = market cap dan warna =
performa (hijau naik, merah turun), untuk melihat sekilas apa yang naik/turun di daftar
favorit atau satu sektor IDX.

## Spec / kriteria selesai
- [x] Komponen `MarketMapPanel` menampilkan treemap untuk (a) daftar favorit user
      (favorites.ts) dan (b) sektor IDX dari `src/sectors.ts`.
- [x] Ukuran kotak proporsional market cap (squarify ditulis tangan, coverage penuh &
      tanpa overlap — diuji); warna gradasi merah→hijau berdasar perubahan harga harian.
- [x] Klik kotak → membuka simbol itu di chart utama.
- [x] Label & legenda Bahasa Indonesia: "Kotak besar = perusahaan besar, hijau = naik,
      merah = turun" ([PLAN.md](../../PLAN.md) §3).
- [x] Data market cap & perubahan diambil sekali per refresh (endpoint /marketmap batch).

## Catatan teknis
- Bergantung pada task 013 (harga dari cache; market cap dari fundamentals yang sudah ada).
- Layout treemap squarified bisa ditulis tangan (±50 baris) atau render langsung dengan
  div CSS — jangan tambah library chart baru; `lightweight-charts` tidak punya treemap.
- Pola panel: ikuti `RRGPanel.tsx` (panel mapping yang sudah ada).

## Verifikasi
- Buka Peta Pasar untuk favorit + satu sektor IDX: proporsi kotak masuk akal (saham
  market cap besar dominan), warna cocok dengan perubahan harga hari itu.
- Klik kotak → chart pindah ke simbol tersebut.
