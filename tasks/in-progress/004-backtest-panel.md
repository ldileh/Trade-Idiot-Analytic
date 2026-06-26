---
id: 004
title: Panel backtesting (form + hasil + equity curve)
branch: task/004-backtest-panel
status: in-progress
created: 2026-06-25
---

# 004 — Panel backtesting (form + hasil + equity curve)

## Tujuan
UI untuk menjalankan backtest strategi terhadap data historis lewat `/backtest`,
menampilkan metrik ringkasan dan kurva ekuitas.

## Spec / kriteria selesai
- [x] `BacktestPanel.tsx`: form pilih strategi (`sma_cross` / `rsi_reversion`) + parameter (fast/slow, rsi_period/lower/upper, cash, commission).
- [x] Tombol "Run backtest" memanggil `/backtest` dan menampilkan loading.
- [x] Tampilkan metrik dari `stats` (Return %, # Trades, Sharpe, Max Drawdown, Win Rate, dll) dalam bentuk tabel/kartu.
- [x] Render equity curve (line chart) dari `equity_curve` (lightweight-charts atau chart kedua).
- [x] Validasi error backend ditampilkan rapi (mis. `fast >= slow` → 422 → pesan jelas).

## Catatan teknis
- Strategi & parameter mengikuti `BacktestRequest` di backend `app/models.py`.
- Bergantung task 001; idealnya berbagi ticker/interval/range dengan chart panel (002).

## Verifikasi
- Start backend + frontend, jalankan `sma_cross 10/30` pada `AAPL 2y` → metrik & equity curve tampil.
- Set `fast=30, slow=10` → pesan error 422 tampil, tidak crash.
