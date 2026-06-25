---
id: 002
title: Candlestick chart panel + input ticker
branch: task/002-chart-panel
status: backlog
created: 2026-06-25
---

# 002 — Candlestick chart panel + input ticker

## Tujuan
Menampilkan candlestick chart saham US dari endpoint `/prices`, dengan input
ticker/interval/range, memakai TradingView lightweight-charts.

## Spec / kriteria selesai
- [ ] `TickerInput.tsx`: input ticker + dropdown interval (`1d/1wk/1mo/1h/...`) & range (`1mo/.../max`).
- [ ] `ChartPanel.tsx`: render candlestick series dari data `/prices` via lightweight-charts.
- [ ] Loading & error state (mis. ticker tidak ditemukan → tampilkan pesan dari 404 backend).
- [ ] Chart responsif terhadap resize window.
- [ ] Data diambil lewat `src/api/client.ts` (task 001), bukan fetch langsung tersebar.

## Catatan teknis
- `time` dari backend = epoch detik → lightweight-charts pakai UTCTimestamp.
- Bergantung pada task 001 (scaffold) selesai lebih dulu.
- Backend harus jalan (skill `run-backend`) untuk verifikasi end-to-end.

## Verifikasi
- Start backend, jalankan frontend, input `AAPL` → candle muncul.
- Coba ticker invalid → pesan error tampil, tidak crash.
