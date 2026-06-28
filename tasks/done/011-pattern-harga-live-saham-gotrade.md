---
id: 011
title: Deteksi pola (pattern) internasional, chart harga live, daftar saham Gotrade lengkap, fix scroll popup
branch: task/011-pattern-harga-live-saham-gotrade
status: done
created: 2026-06-28
---

# 011 — Pattern internasional + harga live + saham Gotrade + fix popup

## Tujuan
Menambah informasi pola grafik (pattern) internasional sebagai bahan keputusan trading,
membuat chart mengikuti harga saat ini, melengkapi daftar kode saham sesuai universe
platform Gotrade (saham & ETF bursa AS — NOK dll), dan memperbaiki scroll horizontal
yang muncul di popup backtest.

## Spec / kriteria selesai
- [x] **Deteksi pola otomatis** dari harga yang sedang ditampilkan: tren naik/turun/sideways,
  golden/death cross, double top/bottom, head & shoulders (+ inverse), breakout/breakdown,
  RSI overbought/oversold. Backend `services/patterns.py` + endpoint `GET /patterns`.
- [x] **Panel "Pola terdeteksi"** di sidebar kiri: banner bias (naik/turun/imbang) + kartu
  per pola (warna bullish/bearish + penjelasan), semua bahasa Indonesia dari backend.
- [x] **Marker pola di chart** (▲ bullish di bawah bar, ▼ bearish di atas bar).
- [x] **Chart harga saat ini**: garis "Harga sekarang" di harga terakhir + auto-refresh
  diam-diam tiap 60 dtk (tanpa reset zoom / loading bar).
- [x] **Daftar saham = universe Gotrade**: di-generate dari direktori Nasdaq Trader
  (saham + ADR + ETF bursa AS; buang warrant/unit/preferred/notes/test issue). 11.714 simbol,
  NOK termasuk. Script `scripts/gen-stocks.mjs` → `src/stocks.data.ts`.
- [x] **Fix scroll horizontal popup**: `.modal-body { overflow-x: hidden }`.
- [x] Build lolos: `tsc --noEmit` + `vite build`; self-check `python -m app.services.patterns`.

## Catatan teknis
- Daftar Gotrade tidak punya API publik resmi; direktori Nasdaq/NYSE adalah sumber otoritatif
  untuk simbol yang listing di bursa AS = universe yang ditradingkan Gotrade (saham & ETF).
  Refresh: `node scripts/gen-stocks.mjs`.
- Backend cache harga 60 dtk, jadi interval auto-refresh diset 60 dtk (selaras).

## Verifikasi
- `npx tsc --noEmit` & `npx vite build` sukses.
- `python -m app.services.patterns` → demo OK.
- Live: `get_ohlcv('NOK','1d','1y')` → `detect()` mengembalikan bias + pola.
