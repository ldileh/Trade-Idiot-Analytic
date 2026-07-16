# REFERENCES.md — Sumber & Referensi

Sumber riset, data, dan dokumentasi yang mendasari [PLAN.md](PLAN.md). Satu baris konteks
per sumber. Aturan main: hanya API resmi/legal (lihat konvensi di [AGENTS.md](AGENTS.md) §8).

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

## RRG (Relative Rotation Graph)

- Konsep JdK RS-Ratio / RS-Momentum oleh Julius de Kempenaer:
  https://www.relativerotationgraphs.com/
- StockCharts ChartSchool, penjelasan kuadran Leading/Weakening/Lagging/Improving:
  https://school.stockcharts.com/doku.php?id=chart_analysis:rrg_charts

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
