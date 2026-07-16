---
id: 012
title: Interface DataProvider di backend
branch: task/012-data-provider-interface
status: in-progress
created: 2026-07-16
---

# 012 — Interface `DataProvider` di backend

## Tujuan
Refactor `backend/app/services/data.py` menjadi abstraksi provider (`get_quote`,
`get_historical`, `get_fundamentals`, `get_ownership_flow`) agar sumber data bisa
ditukar per fitur/per user (dasar untuk task 013, 017, 018), tanpa mengubah perilaku
endpoint yang ada.

## Spec / kriteria selesai
- [ ] Ada base class/protocol `DataProvider` dengan method `get_quote`, `get_historical`,
      `get_fundamentals`, `get_ownership_flow` (boleh `NotImplementedError` untuk yang
      belum relevan per provider).
- [ ] Implementasi default `YahooProvider` membungkus logika yfinance yang ada sekarang;
      patch realtime Finnhub untuk US tetap berfungsi seperti sebelumnya.
- [ ] Logika KSEI di `ownership.py` terekspos lewat interface yang sama
      (`get_ownership_flow`).
- [ ] Router (`prices`, `fundamentals`, `ownership`, dst.) memanggil lewat interface,
      bukan langsung ke yfinance.
- [ ] Respons semua endpoint identik dengan sebelum refactor (termasuk field `source`).

## Catatan teknis
- Titik masuk: `backend/app/services/data.py` (yfinance + Finnhub + cache TTL 30 detik),
  `fundamentals.py`, `ownership.py`. Cache in-memory 30 detik ikut pindah ke dalam/di
  belakang provider — jangan dihilangkan.
- Ini refactor murni — belum ada provider baru (Stooq dst. datang di task 013/018).
- Acuan desain: [PLAN.md](../../PLAN.md) §1.

## Verifikasi
- Jalankan backend (`/run-backend`), uji `GET /prices?ticker=AAPL`, `GET /prices?ticker=BBCA.JK`,
  `GET /fundamentals?ticker=MSFT`, `GET /ownership?ticker=BBCA.JK` — hasil sama seperti
  sebelum refactor (bandingkan field & `source`).
- Patch Finnhub: dengan `FINNHUB_API_KEY` terpasang, harga US terbaru tetap ter-update.
