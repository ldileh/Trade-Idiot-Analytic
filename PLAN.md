# PLAN.md — Roadmap Pengembangan

Acuan tambahan untuk fase pengembangan berikutnya: arsitektur sumber data yang bisa
diganti-ganti (BYOK — bring your own key), kerangka analisis fundamental & teknikal, dan
pelabelan bahasa pemula. Melengkapi [AGENTS.md](AGENTS.md) (arsitektur & konvensi yang
sudah final) — bukan menggantikannya. Sumber riset & dokumentasi API ada di
[REFERENCES.md](REFERENCES.md). Pengerjaan dipecah menjadi task **012–020** di board
[tasks/](tasks/README.md).

**Konteks & batasan**: app analisa saham personal (US + IDX) untuk pemula, bahasa
sederhana. Sumber data saat ini Yahoo Finance via yfinance (~15 menit delay) + patch
realtime Finnhub untuk US. Budget rendah — sumber berbayar harus jadi **opsi konfigurasi**
(key milik user sendiri), bukan dependency wajib.

---

## 1. Arsitektur sumber data

**Prinsip**: satu interface (`get_quote()`, `get_historical()`, `get_fundamentals()`,
`get_ownership_flow()`) yang diimplementasikan banyak provider, sehingga sumber bisa
ditukar per fitur dan per user. Titik masuknya
[backend/app/services/data.py](backend/app/services/data.py) — saat ini satu jalur
hardcoded yfinance + Finnhub dengan cache in-memory 30 detik.

| Fitur | Sumber default (gratis) | Catatan |
|---|---|---|
| Chart / harga live | Yahoo Finance (status quo) | Tetap, tanpa biaya |
| Backfill historis (backtesting) | Stooq.com (tanpa key, tanpa limit) + file EOD resmi IDX (idx.co.id) | Tarik sekali secara massal, cache lokal — ini yang memberi "data besar" tanpa kena rate limit |
| Fundamental (US) | Financial Modeling Prep free tier (250 req/hari) | Rasio & laporan keuangan riil |
| Fundamental (IDX) | Sectors.app free tier | Native IDX, termasuk bandarmology |
| Momentum / indikator | Dihitung lokal dari OHLCV ter-cache; Twelve Data free tier (800 req/hari, delay 4 jam) sebagai opsi | Cukup untuk scan refresh harian |
| Kepemilikan / broker flow (IDX) | KSEI (arsip ZIP, sudah jalan di `ownership.py`) + Sectors.app | Tidak dicakup API gratis US-centric mana pun |
| Deteksi pola | Dihitung lokal dari OHLCV ter-cache | Tanpa panggilan eksternal |

**Item implementasi** (→ nomor task di board):

- Interface `DataProvider` + adapter per sumber → **012**, **018**
- Layer cache lokal (SQLite): simpan bar historis sekali, sinkron delta saja → **013**
- Layar pengaturan "Sumber Data": per fitur, pilih Default (gratis) atau Custom (API key user) → **017**
- Toggle "Hemat Data" (free tier, delayed) vs "Real-time" (butuh key berbayar user) → **017**

## 2. Kerangka analisis

### Fundamental — dua skor terpisah, bukan satu angka campuran

- **Skor Kesehatan Keuangan** — model Piotroski F-Score: 9 sinyal akuntansi biner
  (profitabilitas, leverage/likuiditas, efisiensi) → 0–9. (→ **014**)
- **Skor Risiko Bangkrut** — model Altman Z-Score: 5 rasio (modal kerja/aset, laba
  ditahan/aset, EBIT/aset, ekuitas pasar/liabilitas, penjualan/aset). (→ **014**)
- Sengaja **dua angka terpisah**, bukan satu "Fundamental 62" — lebih jelas untuk user
  dan lebih sesuai riset yang mendasarinya. Pola scoring yang sudah ada
  ([backend/app/services/fundamentals.py](backend/app/services/fundamentals.py):
  `_METRICS` + judge + tip BI) diperluas; butuh laporan keuangan
  (`.financials`/`.balance_sheet` yfinance — belum dipakai di mana pun).

### Teknikal / tren

- **Momentum multi-timeframe**: periode formasi 1/3/6 bulan (riset momentum Jegadeesh &
  Titman) alih-alih satu pembacaan RSI/Stochastic tunggal. (→ **015**)
- **Konfirmasi tren**: MA crossover (Golden/Death Cross) **plus** konfirmasi volume
  (OBV/VWAP) bersamaan, bukan MA crossover sendirian — riset out-of-sample menunjukkan
  reliabilitas aturan MA sederhana meluruh sejak 1990-an. Beri caveat di UI.
- Set indikator standar: SMA/EMA, MACD, ADX (tren); RSI, Stochastic (momentum);
  Bollinger Bands, ATR (volatilitas); OBV, VWAP (volume). Sebagian sudah ada di
  `backend/app/services/indicators.py` (library `ta`).

### Mapping

- **Treemap / Peta Pasar**: ukuran kotak = market cap, warna = performa — untuk "apa yang
  naik/turun sekarang" di daftar favorit atau per sektor IDX. (→ **019**)
- **RRG (kuadran rotasi relatif)**: **sudah ada** ([src/components/RRGPanel.tsx](src/components/RRGPanel.tsx),
  [backend/app/services/rrg.py](backend/app/services/rrg.py)) — tinggal relabel kuadran
  ke bahasa pemula (→ **016**).
- **Korelasi / Saham yang Gerak Bareng**: konteks di halaman posisi — apakah saham ini
  bergerak bersama sektornya atau sendiri. (→ **020**)

## 3. Label bahasa pemula (copy UI, Bahasa Indonesia)

| Istilah teknis | Label di app | Penjelasan satu baris |
|---|---|---|
| Piotroski F-Score | Skor Kesehatan Keuangan | Menilai apakah perusahaan untung, hutangnya wajar, dan operasinya makin efisien |
| Altman Z-Score | Skor Risiko Bangkrut | Menilai kemungkinan perusahaan kesulitan keuangan 1-2 tahun ke depan |
| Golden Cross | Tren Naik (sudah ada) | Rata-rata harga jangka pendek melewati rata-rata jangka panjang — cek juga indikator lain, tidak selalu akurat |
| Momentum multi-timeframe | Kekuatan Tren: 1 Bulan / 3 Bulan / 6 Bulan | 3 angka terpisah, bukan 1, agar terlihat apakah tren baru mulai atau sudah lama |
| RSI/Stochastic (overbought/oversold) | Sudah Kemahalan / Sudah Kemurahan | Lebih akrab daripada istilah "overbought/oversold" |
| Volatilitas (ATR/Bollinger) | Tingkat Gejolak Harga: Tinggi/Sedang/Rendah | Ganti istilah "volatilitas" |
| Volume + OBV | Minat Beli: Kuat/Lemah | Apakah kenaikan harga didukung banyak transaksi |
| Treemap/Heatmap | Peta Pasar | Kotak besar = perusahaan besar, hijau = naik, merah = turun |
| Kuadran RRG | Peta Arah Sektor: Lagi Naik Daun / Mulai Melemah / Lagi Lesu / Mulai Bangkit | Pengganti istilah Leading/Weakening/Lagging/Improving |
| Korelasi | Saham yang Gerak Bareng | Saham lain yang biasanya naik-turun bersamaan |

**Aturan penulisan**: satu istilah teknis = satu label sederhana yang konsisten di
seluruh app (jangan bergantian antara istilah teknis dan sederhananya). Sinyal dengan
dukungan riset campuran (mis. Golden Cross) diberi caveat singkat agar pemula tidak
membacanya sebagai jaminan. Kamus label terpusat di [src/help.ts](src/help.ts); copy BI
backend di `fundamentals.py` dan `patterns.py` mengikuti tabel ini. (→ **016**)

## 4. Urutan build → board task

Urutan disarankan (dependensi di kolom terakhir). Board: [tasks/](tasks/README.md).

| Urutan | Task | Judul | Bergantung pada |
|---|---|---|---|
| 1 | 012 | Interface `DataProvider` di backend | — |
| 2 | 013 | Backfill historis massal (Stooq + IDX EOD) + cache lokal SQLite | 012 |
| 3 | 014 | Skor Kesehatan Keuangan (Piotroski) + Skor Risiko Bangkrut (Altman) | — |
| 4 | 015 | Kekuatan Tren multi-timeframe (1/3/6 bulan) | 013 |
| 5 | 016 | Label bahasa pemula konsisten di seluruh app | — |
| 6 | 017 | Layar pengaturan "Sumber Data" (BYOK) + toggle Hemat Data/Real-time | 012 |
| 7 | 018 | Adapter provider opsional: FMP, Sectors.app, Twelve Data | 012, 017 |
| 8 | 019 | Peta Pasar (treemap) | 013 |
| 9 | 020 | Saham yang Gerak Bareng (korelasi) | 013 |

Task 014 dan 016 tidak bergantung pada data layer — bisa dikerjakan paralel kapan saja.
