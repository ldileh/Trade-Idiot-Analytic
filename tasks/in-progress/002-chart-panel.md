---
id: 002
title: Candlestick chart panel + input ticker
branch: task/002-chart-panel
status: in-progress
created: 2026-06-25
---

# 002 — Candlestick chart panel + input ticker

## Tujuan
Menampilkan candlestick chart saham US dari endpoint `/prices`, dengan input
ticker/interval/range, memakai TradingView lightweight-charts.

## Spec / kriteria selesai
- [x] `TickerInput.tsx`: input ticker + dropdown interval (`1d/1wk/1mo/1h/...`) & range (`1mo/.../max`).
- [x] `ChartPanel.tsx`: render candlestick series dari data `/prices` via lightweight-charts.
- [x] Loading & error state (mis. ticker tidak ditemukan → tampilkan pesan dari 404 backend).
- [x] Chart responsif terhadap resize window.
- [x] Data diambil lewat `src/api/client.ts` (task 001), bukan fetch langsung tersebar.

## Catatan teknis
- `time` dari backend = epoch detik → lightweight-charts pakai UTCTimestamp.
- Bergantung pada task 001 (scaffold) selesai lebih dulu.
- Backend harus jalan (skill `run-backend`) untuk verifikasi end-to-end.

## Verifikasi
- Start backend, jalankan frontend, input `AAPL` → candle muncul.
- Coba ticker invalid → pesan error tampil, tidak crash.
