---
id: 016
title: Label bahasa pemula konsisten di seluruh app
branch: task/016-label-bahasa-pemula
status: in-progress
created: 2026-07-16
---

# 016 — Label bahasa pemula konsisten di seluruh app

## Tujuan
Menerapkan tabel label pemula ([PLAN.md](../../PLAN.md) §3) secara konsisten: satu istilah
teknis = satu label sederhana di semua tempat, plus caveat singkat pada sinyal yang
dukungan risetnya campuran (mis. Golden Cross), agar pemula tidak membacanya sebagai
jaminan.

## Spec / kriteria selesai
- [x] Kamus label di `src/help.ts` diperluas mengikuti tabel PLAN.md §3 (GLOSSARY: Skor
      Kesehatan Keuangan, Skor Risiko Bangkrut, Kekuatan Tren, Sudah Kemahalan/Kemurahan,
      Tingkat Gejolak Harga, Minat Beli, Peta Pasar, Peta Arah Sektor, Saham yang Gerak Bareng).
- [x] Kuadran RRG di `RRGPanel.tsx`/`RRGChart.tsx` memakai label "Lagi Naik Daun / Mulai
      Melemah / Lagi Lesu / Mulai Bangkit" (+ subtitle/tombol/aria-label App.tsx).
- [x] Copy BI backend (`patterns.py`) memakai istilah yang sama dengan kamus frontend —
      "Sudah Kemahalan/Kemurahan" (bukan Overbought/Oversold).
- [x] Sinyal Golden Cross/Death Cross + RSI menyertakan caveat "cek juga indikator lain,
      tidak selalu akurat".
- [x] Tidak ada sisa istilah "overbought/oversold/leading/lagging/Relative Rotation" di copy
      yang dilihat user (sisa hanya comment kode & nama ETF bursa).

## Catatan teknis
- Murni copy/label — tidak mengubah perhitungan.
- Copy BI tersebar di tiga tempat: `src/help.ts` (kamus utama),
  `backend/app/services/fundamentals.py` (`_VERDICT_TEXT`, tip), dan
  `backend/app/services/patterns.py` (deskripsi pola). Samakan lewat tabel PLAN.md.
- Grep istilah lama untuk memastikan tidak ada yang terlewat.

## Verifikasi
- Grep: `overbought|oversold|volatilitas|Leading|Weakening|Lagging|Improving` di `src/`
  dan copy BI backend → nol hasil pada teks yang tampil ke user.
- Buka app: panel fundamental, pola, RRG, indikator — label sesuai tabel dan konsisten
  antar panel.
