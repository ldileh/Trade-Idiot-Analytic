---
id: 003
title: Overlay indikator teknikal pada chart
branch: task/003-indicator-overlay
status: done
created: 2026-06-25
---

# 003 — Overlay indikator teknikal pada chart

## Tujuan
Memungkinkan user memilih indikator (SMA/EMA/RSI/MACD/Bollinger/ATR) dan
menampilkannya di chart, memakai endpoint `/indicators`.

## Spec / kriteria selesai
- [x] `IndicatorControls.tsx`: UI memilih indikator + parameter `period`.
- [x] Overlay pada panel harga: SMA/EMA/Bollinger digambar sebagai line series di chart utama.
- [x] Indikator oscillator (RSI/MACD/ATR) tampil di pane/area terpisah di bawah chart harga.
- [x] Nilai `null` (warm-up) di-skip, garis tidak putus aneh.
- [x] Bisa menambah & menghapus indikator tanpa reload seluruh halaman.

## Catatan teknis
- `/indicators` mengembalikan beberapa series per indikator (mis. MACD → macd/signal/hist, bbands → upper/mid/lower).
- Selaraskan `time` indikator dengan candle (keduanya epoch detik, urutan sama).
- Bergantung task 002 (chart panel).

## Verifikasi
- Start backend + frontend, tambahkan EMA20 → garis muncul menempel candle.
- Tambahkan RSI14 → pane terpisah muncul; hapus indikator → hilang.
