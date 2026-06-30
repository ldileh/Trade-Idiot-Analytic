# Trade-Idiot-Analytic — Backend

Local FastAPI sidecar for US stock technical analysis & backtesting. Data via
yfinance; indicators via `ta`; backtests via `backtesting.py`. Binds to
`127.0.0.1` only (it is launched as a Tauri sidecar, never network-exposed).

## Requirements

- **Python 3.12** (the numpy 1.26 / pandas 2.2 pins do not support 3.13).

## Setup

```bash
python3.12 -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt  # POSIX
```

## Run

```bash
.venv/Scripts/python main.py
# BACKEND_PORT (default 8756) and BACKEND_HOST (default 127.0.0.1) override binding.
```

Then open http://127.0.0.1:8756/docs for the interactive API.

### Realtime US quotes (optional)

yfinance is ~15 min delayed for the in-progress bar. Set a free
[Finnhub](https://finnhub.io) key to make the latest US price realtime — the
latest candle's close is patched with Finnhub's `/quote`. Unset = yfinance only
(unchanged); IDX `.JK` tickers always use yfinance (Finnhub has no IDX realtime).

```bash
FINNHUB_API_KEY=your_key_here .venv/Scripts/python main.py
```

## Endpoints

| Method | Path          | Purpose                                             |
|--------|---------------|-----------------------------------------------------|
| GET    | `/health`     | Liveness check.                                     |
| GET    | `/prices`     | OHLCV candles: `?ticker=AAPL&interval=1d&range=1y`. |
| POST   | `/indicators` | Compute sma/ema/rsi/macd/bbands/atr.                |
| POST   | `/backtest`   | Run `sma_cross` or `rsi_reversion`; stats + equity. |

## Layout

```
backend/
├── main.py                  # uvicorn entry point
├── requirements.txt
└── app/
    ├── __init__.py          # FastAPI app factory, CORS, /health
    ├── models.py            # pydantic request/response schemas
    ├── routers/             # prices, indicators, backtest
    └── services/            # data (yfinance+cache), indicators (ta), strategies
```
