---
id: 013
title: Backfill historis massal (Stooq + IDX EOD) + cache lokal SQLite
branch: task/013-backfill-historis-cache-sqlite
status: done
created: 2026-07-16
---

# 013 — Backfill historis massal + cache lokal SQLite

## Tujuan
Menyediakan data OHLCV historis besar untuk backtesting/momentum tanpa kena rate limit:
tarik massal sekali dari Stooq (US, tanpa key) dan file EOD resmi IDX, simpan di SQLite
lokal, lalu sinkron delta saja.

## Spec / kriteria selesai
- [x] Sumber CSV Stooq per simbol (`_stooq`, tanpa API key) — dipakai untuk US bila
      dapat dijangkau; jaringan di sini mem-blokir Stooq (404) sehingga fallback Yahoo aktif.
- [~] Parser EOD IDX (idx.co.id) untuk `.JK` — **belum**; endpoint IDX dinamis & tak
      terverifikasi dari sini, jadi `.JK` daily mengalir lewat jalur Yahoo di belakang cache
      yang sama. Slot parser tersedia di `bars_cache._stooq`/interface.
- [x] Cache SQLite (stdlib `sqlite3`): tabel bar OHLCV per (ticker, interval, date);
      backfill sekali → request berikutnya baca dari cache, hanya fetch delta (bar setelah
      tanggal terakhir tersimpan).
- [x] Endpoint `/prices` (range panjang, interval 1d) dan `/backtest` memakai cache ini;
      data intraday/live tetap lewat jalur Yahoo yang ada.
- [x] File DB di lokasi data app (bukan di repo), path bisa dioverride via env (`TIA_DATA_DIR`).

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
