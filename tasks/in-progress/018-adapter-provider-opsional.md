---
id: 018
title: Adapter provider opsional (FMP, Sectors.app, Twelve Data)
branch: task/018-adapter-provider-opsional
status: in-progress
created: 2026-07-16
---

# 018 — Adapter provider opsional: FMP, Sectors.app, Twelve Data

## Tujuan
Menambah implementasi `DataProvider` eksternal yang bisa dipilih user via layar
Sumber Data (BYOK): Financial Modeling Prep (fundamental US), Sectors.app (fundamental
IDX + bandarmology), dan Twelve Data (indikator delayed) — semua free tier dengan key
milik user.

## Spec / kriteria selesai
- [ ] `FMPProvider.get_fundamentals` — laporan keuangan/rasio US dari FMP free tier
      (250 req/hari), dipetakan ke schema `FundamentalsResponse` yang ada.
- [ ] `SectorsProvider` — fundamental + ownership/bandarmology saham IDX dari Sectors.app
      free tier, dipetakan ke schema fundamentals & ownership yang ada.
- [ ] `TwelveDataProvider.get_historical` — bar delayed (free tier 800 req/hari) sebagai
      sumber alternatif untuk scan/momentum.
- [ ] Semua adapter muncul sebagai pilihan di layar Sumber Data (task 017) dan hanya
      aktif bila user mengisi key-nya.
- [ ] Kena rate limit / key salah → pesan jelas ke user + fallback ke provider default,
      bukan crash.

## Catatan teknis
- Bergantung pada task 012 (interface) dan 017 (BYOK settings).
- Pakai `requests` yang sudah terpasang — tanpa SDK/dependency baru.
- F-Score/Z-Score (task 014) idealnya bisa dihitung dari data FMP juga bila provider
  fundamental = FMP — samakan bentuk data di layer provider, bukan di scorer.
- Dokumentasi API di [REFERENCES.md](../../REFERENCES.md) §Sumber data.

## Verifikasi
- Dengan key FMP uji `GET /fundamentals?ticker=AAPL` (provider=fmp) → rasio riil, schema
  sama dengan provider Yahoo.
- Dengan key Sectors.app uji fundamental + ownership BBCA.JK.
- Cabut key / pakai key salah → app tetap jalan dengan provider default + pesan jelas.
