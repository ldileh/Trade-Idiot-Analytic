---
id: 013
title: Backfill historis massal (Stooq + IDX EOD) + cache lokal SQLite
branch: task/013-backfill-historis-cache-sqlite
status: backlog
created: 2026-07-16
---

# 013 — Backfill historis massal + cache lokal SQLite

## Tujuan
Menyediakan data OHLCV historis besar untuk backtesting/momentum tanpa kena rate limit:
tarik massal sekali dari Stooq (US, tanpa key) dan file EOD resmi IDX, simpan di SQLite
lokal, lalu sinkron delta saja.

## Spec / kriteria selesai
- [ ] `StooqProvider` (implementasi `DataProvider.get_historical`) — CSV per simbol dari
      stooq.com, tanpa API key.
- [ ] Parser file ringkasan perdagangan EOD IDX (idx.co.id) untuk simbol `.JK`.
- [ ] Cache SQLite (stdlib `sqlite3`): tabel bar OHLCV per (ticker, interval, date);
      backfill sekali → request berikutnya baca dari cache, hanya fetch delta (bar setelah
      tanggal terakhir tersimpan).
- [ ] Endpoint `/prices` (range panjang, interval 1d) dan `/backtest` memakai cache ini;
      data intraday/live tetap lewat jalur Yahoo yang ada.
- [ ] File DB di lokasi data app (bukan di repo), path bisa dioverride via env.

## Catatan teknis
- Bergantung pada task 012 (interface `DataProvider`).
- SQLite via stdlib — jangan tambah ORM/dependency baru.
- Format CSV Stooq: `https://stooq.com/q/d/l/?s=aapl.us&i=d`. Simbol IDX di Stooq tidak
  lengkap — karena itu perlu jalur file EOD IDX.
- Acuan: [PLAN.md](../../PLAN.md) §1, sumber di [REFERENCES.md](../../REFERENCES.md).

## Verifikasi
- Backfill AAPL 10 tahun → hitung jumlah bar di DB; panggil `/prices?range=10y` dua kali,
  panggilan kedua tidak fetch jaringan (cek log) dan hasilnya sama.
- Simbol IDX (mis. BBCA.JK) terisi dari file EOD IDX.
- `/backtest` terhadap range panjang jalan dari cache tanpa error.
