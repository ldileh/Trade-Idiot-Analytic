---
id: 014
title: Skor Kesehatan Keuangan (Piotroski) + Skor Risiko Bangkrut (Altman)
branch: task/014-skor-piotroski-altman
status: backlog
created: 2026-07-16
---

# 014 — Skor Kesehatan Keuangan (Piotroski) + Skor Risiko Bangkrut (Altman)

## Tujuan
Memecah penilaian fundamental menjadi dua angka terpisah yang didukung riset:
Piotroski F-Score (0–9) sebagai "Skor Kesehatan Keuangan" dan Altman Z-Score sebagai
"Skor Risiko Bangkrut" — bukan satu skor campuran.

## Spec / kriteria selesai
- [ ] Backend menghitung F-Score: 9 sinyal biner (profitabilitas, leverage/likuiditas,
      efisiensi) dari laporan keuangan yfinance (`.financials`, `.balance_sheet`,
      `.cashflow`) → 0–9 + rincian sinyal mana yang lolos.
- [ ] Backend menghitung Z-Score: 5 rasio (modal kerja/aset, laba ditahan/aset, EBIT/aset,
      ekuitas pasar/liabilitas, penjualan/aset) + zona (aman/abu-abu/bahaya).
- [ ] Respons `/fundamentals` memuat kedua skor terpisah + tip Bahasa Indonesia per skor
      (label sesuai tabel [PLAN.md](../../PLAN.md) §3).
- [ ] `FundamentalsPanel.tsx` menampilkan dua skor sebagai dua angka/kartu terpisah.
- [ ] Data laporan keuangan tidak lengkap (umum di saham IDX) → skor tampil "tidak cukup
      data", bukan angka menyesatkan atau error 500.

## Catatan teknis
- Perluas pola yang ada di `backend/app/services/fundamentals.py` (`_METRICS` + judge +
  tip BI); `.financials`/`.balance_sheet` yfinance belum pernah dipakai — cek ketersediaan
  field per market (US vs `.JK`).
- Cache hasil per ticker (pola cache 1 jam yang sudah ada di `fundamentals.py`).
- Referensi paper di [REFERENCES.md](../../REFERENCES.md) §Skor fundamental.

## Verifikasi
- `GET /fundamentals?ticker=AAPL` → F-Score & Z-Score masuk akal (bandingkan manual
  dengan angka laporan keuangan dari yfinance).
- Ticker IDX dengan data tipis → respons "tidak cukup data" tanpa error.
- Panel frontend menampilkan dua skor dengan label BI yang benar.
