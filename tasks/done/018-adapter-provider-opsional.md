---
id: 018
title: Adapter provider opsional (FMP, Sectors.app, Twelve Data)
branch: task/018-adapter-provider-opsional
status: done
created: 2026-07-16
---

# 018 — Adapter provider opsional: FMP, Sectors.app, Twelve Data

## Tujuan
Menambah implementasi `DataProvider` eksternal yang bisa dipilih user via layar
Sumber Data (BYOK): Financial Modeling Prep (fundamental US), Sectors.app (fundamental
IDX + bandarmology), dan Twelve Data (indikator delayed) — semua free tier dengan key
milik user.

## Spec / kriteria selesai
- [x] `FMPProvider.get_fundamentals` — rasio TTM US dari FMP (profile+ratios-ttm),
      dipetakan ke schema `FundamentalsResponse` (delegasi ke scorer bersama).
- [~] `SectorsProvider` — fundamental IDX dipetakan; ownership/bandarmology masih
      raise → fallback KSEI (endpoint Sectors belum diverifikasi tanpa key).
- [x] `TwelveDataProvider.get_historical` — bar delayed (time_series) sbg sumber
      alternatif untuk scan/momentum.
- [x] Semua adapter muncul sebagai pilihan di layar Sumber Data (task 017, +twelvedata)
      dan hanya aktif bila user mengisi key-nya (`build()` return None bila keyless).
- [x] Kena rate limit / key salah → pesan jelas (401/403/429 → ProviderKeyError) +
      fallback ke provider default, bukan crash. Diuji: FMP/TwelveData/Sectors key palsu
      semua fallback ke default, key tidak bocor ke log.

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
