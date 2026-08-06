# REFERENCES.md — Sumber & Referensi

Sumber riset, data, dan dokumentasi yang mendasari [PLAN.md](PLAN.md). Satu baris konteks
per sumber. Aturan main: hanya API resmi/legal (lihat konvensi di [AGENTS.md](AGENTS.md) §8).

> **Versi untuk user ada di dalam app**: menu ⚙️ → **🎓 Dasar Ilmiah**. Isinya dari
> [`src/references.ts`](src/references.ts) — katalog tiap metode yang diimplementasi beserta
> temuan risetnya, ditandai per tingkat bukti (jurnal ber-review / standar industri / bukti
> campuran / heuristik app ini). **Saat menambah metode baru ke backend, tambahkan entrinya
> di file itu juga**, supaya klaim di UI tidak melenceng dari yang benar-benar dihitung.

---

## Skor fundamental

- **Piotroski (2000), "Value Investing: The Use of Historical Financial Statement
  Information"** — dasar F-Score 9 sinyal (Skor Kesehatan Keuangan).
  https://papers.ssrn.com/sol3/papers.cfm?abstract_id=249455
- **Altman (1968), "Financial Ratios, Discriminant Analysis and the Prediction of
  Corporate Bankruptcy"** — dasar Z-Score 5 rasio (Skor Risiko Bangkrut).
  Ringkasan model oleh penulisnya: https://pages.stern.nyu.edu/~ealtman/Zscores.pdf
- Penjelasan populer (untuk copy UI): Investopedia
  [Piotroski Score](https://www.investopedia.com/terms/p/piotroski-score.asp) ·
  [Altman Z-Score](https://www.investopedia.com/terms/a/altman.asp)

## Momentum & tren

- **Jegadeesh & Titman (1993), "Returns to Buying Winners and Selling Losers"** — dasar
  momentum multi-timeframe (periode formasi 3/6/12 bulan).
  https://onlinelibrary.wiley.com/doi/10.1111/j.1540-6261.1993.tb04702.x
- **Sullivan, Timmermann & White (1999), "Data-Snooping, Technical Trading Rule
  Performance, and the Bootstrap"** — bukti reliabilitas aturan MA sederhana meluruh
  out-of-sample sejak 1990-an; alasan caveat pada Golden Cross.
  https://onlinelibrary.wiley.com/doi/10.1111/0022-1082.00163

## Take profit & manajemen risiko

Dipakai oleh `services/takeprofit.py` (endpoint `/takeprofit` & `/takeprofit/screen`).

- **Wilder (1978), "New Concepts in Technical Trading Systems"** — asal ATR (Average True
  Range); dasar target & stop loss yang jaraknya proporsional dengan volatilitas asli tiap
  saham, bukan persentase bulat seragam. Ringkasan: [Investopedia ATR](https://www.investopedia.com/terms/a/atr.asp)
- **Tharp (1998), "Trade Your Way to Financial Freedom"** — kerangka R-multiple: target
  sebagai kelipatan jarak risiko (entry→stop), plus position sizing 1–2% modal per posisi.
- **George & Hwang (2004), "The 52-Week High and Momentum Investing", Journal of Finance
  59(5):2145-2176** — puncak 52 minggu sebagai jangkar harga; dipakai dua arah di app ini:
  sebagai level target resistance, DAN sebagai alasan menurunkan urgensi jual saat posisi
  masih tren naik di dekat puncak.
  https://onlinelibrary.wiley.com/doi/10.1111/j.1540-6261.2004.00695.x
- **Le Beau, Chuck — Chandelier Exit** (`highest_high(22) − 3×ATR22`) — trailing stop yang
  hanya bergerak naik; dasar strategi "biarkan untung berjalan".
  https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays/technical-indicators/chandelier-exit
- **Shefrin & Statman (1985), "The Disposition to Sell Winners Too Early and Ride Losers
  Too Long", Journal of Finance 40(3)** — disposition effect; alasan app menolak
  memproyeksikan target dari harga beli saat posisi rugi dalam (agar tidak jadi angka
  "menunggu balik modal").
  https://onlinelibrary.wiley.com/doi/10.1111/j.1540-6261.1985.tb05002.x
- Jegadeesh & Titman (1993) — lihat bagian Momentum di atas; dipakai sebagai alasan
  memilih trailing stop dibanding target tetap saat tren masih kuat.

## RRG (Relative Rotation Graph)

- Konsep JdK RS-Ratio / RS-Momentum oleh Julius de Kempenaer:
  https://www.relativerotationgraphs.com/
  (StockCharts memindahkan ChartSchool ke domain `chartschool.stockcharts.com`; halaman RRG
  lamanya sudah tidak ada, jadi situs resmi di atas dipakai sebagai sumber utama.)

## Sumber data

| Sumber | Untuk | Akses | Link |
|---|---|---|---|
| Yahoo Finance (via yfinance) | OHLCV + fundamental dasar (status quo, ~15 mnt delay) | Gratis, tanpa key | https://github.com/ranaroussi/yfinance |
| Finnhub | Patch harga realtime US (status quo, opsional) | Free tier, key | https://finnhub.io/docs/api |
| Stooq | Backfill EOD massal, tanpa key & tanpa limit | Gratis | CSV per simbol: https://stooq.com/q/d/ · database massal: https://stooq.com/db/h/ |
| IDX (Bursa Efek Indonesia) | Ringkasan perdagangan EOD resmi saham IDX | Gratis | https://www.idx.co.id/id/data-pasar/ringkasan-perdagangan/ringkasan-saham/ |
| KSEI | Kepemilikan efek IDX (arsip ZIP harian; sudah dipakai `ownership.py`) | Gratis | `https://web.ksei.co.id/Download/BalancePosEfek{YYYYMMDD}.zip` |
| Financial Modeling Prep | Fundamental US (laporan keuangan riil) | Free tier 250 req/hari, key | https://site.financialmodelingprep.com/developer/docs |
| Sectors.app | Fundamental IDX + bandarmology | Free tier, key | https://sectors.app/ |
| Twelve Data | Indikator/momentum delayed (opsi) | Free tier 800 req/hari (delay 4 jam), key | https://twelvedata.com/docs |

## Library terpasang

- **`ta` 0.11.0** — indikator teknikal pure-Python (pengganti pandas-ta yang sudah mati,
  lihat [AGENTS.md](AGENTS.md) §6). https://technical-analysis-library-in-python.readthedocs.io/
- **backtesting.py 0.3.3** — engine backtest + equity curve. https://kernc.github.io/backtesting.py/
- **lightweight-charts** — chart candlestick resmi TradingView (OSS).
  https://github.com/tradingview/lightweight-charts
- **yfinance 1.4.1** — lihat pitfall versi di [AGENTS.md](AGENTS.md) §6.
  https://github.com/ranaroussi/yfinance
