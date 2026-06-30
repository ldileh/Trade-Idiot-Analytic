"""OHLCV data retrieval via yfinance, with a small in-process TTL cache.

yfinance hits Yahoo Finance over the network; caching avoids re-downloading the
same ticker/interval/range within a short window while the user tweaks indicator
or backtest parameters on the same data.
"""
from __future__ import annotations

import os
import time
from threading import Lock

import pandas as pd
import requests
import yfinance as yf

# (ticker, interval, range) -> (fetched_at_epoch, dataframe)
_CACHE: dict[tuple[str, str, str], tuple[float, pd.DataFrame]] = {}
_CACHE_TTL_SECONDS = 30.0  # short, so the live price doesn't lag the market
_LOCK = Lock()

# Realtime last-price override (US only). yfinance is ~15 min delayed for the
# in-progress bar; Finnhub's free /quote is realtime for US tickers, so when a
# key is set we patch the latest candle's close with it. Falls back silently to
# yfinance on any failure or for IDX (.JK) tickers (Finnhub returns 0 there).
_FINNHUB_KEY = os.getenv("FINNHUB_API_KEY", "").strip()
_QUOTE_CACHE: dict[str, tuple[float, float]] = {}  # ticker -> (fetched_at, price)
_QUOTE_TTL_SECONDS = 10.0


class DataError(Exception):
    """Raised when no usable price data could be retrieved for a ticker."""


def _realtime_close(ticker: str) -> float | None:
    """Latest realtime US price from Finnhub, or None if unavailable.

    Fails soft on missing key, IDX tickers, network errors, or a non-positive
    quote — every miss just leaves the yfinance close in place.
    """
    if not _FINNHUB_KEY or ticker.endswith(".JK"):
        return None

    now = time.time()
    cached = _QUOTE_CACHE.get(ticker)
    if cached and (now - cached[0]) < _QUOTE_TTL_SECONDS:
        return cached[1]

    try:
        resp = requests.get(
            "https://finnhub.io/api/v1/quote",
            params={"symbol": ticker, "token": _FINNHUB_KEY},
            timeout=4,
        )
        price = float(resp.json().get("c") or 0.0)
    except (requests.RequestException, ValueError, TypeError):
        return None
    if price <= 0:
        return None

    _QUOTE_CACHE[ticker] = (now, price)
    return price


def _normalize(df: pd.DataFrame) -> pd.DataFrame:
    """Return a clean OHLCV frame with a tz-naive DatetimeIndex.

    yfinance may return a MultiIndex column frame (when given a list of tickers)
    or tz-aware timestamps. Normalize both so downstream code can rely on a flat
    schema: columns Open/High/Low/Close/Volume, ascending DatetimeIndex.
    """
    if isinstance(df.columns, pd.MultiIndex):
        # Single ticker requested -> drop the ticker level.
        df = df.droplevel(axis=1, level=-1)

    df = df.rename(columns=str.title)
    keep = ["Open", "High", "Low", "Close", "Volume"]
    missing = [c for c in keep if c not in df.columns]
    if missing:
        raise DataError(f"Price data missing columns: {missing}")

    df = df[keep].dropna(how="any")
    if df.index.tz is not None:
        df.index = df.index.tz_localize(None)
    df = df.sort_index()
    return df


def get_ohlcv(ticker: str, interval: str, range_: str) -> pd.DataFrame:
    """Fetch OHLCV for a ticker. Cached for `_CACHE_TTL_SECONDS`.

    Returns a DataFrame indexed by datetime with Open/High/Low/Close/Volume.
    Raises DataError if Yahoo returns nothing (e.g. unknown ticker).
    """
    ticker = ticker.strip().upper()
    if not ticker:
        raise DataError("Ticker must not be empty.")

    key = (ticker, interval, range_)
    now = time.time()

    with _LOCK:
        cached = _CACHE.get(key)
        if cached and (now - cached[0]) < _CACHE_TTL_SECONDS:
            return cached[1]

    raw = yf.download(
        tickers=ticker,
        period=range_,
        interval=interval,
        auto_adjust=True,
        progress=False,
        threads=False,
    )

    if raw is None or raw.empty:
        raise DataError(
            f"No price data for '{ticker}' (interval={interval}, range={range_}). "
            "Check the ticker symbol and that the interval/range combination is valid."
        )

    df = _normalize(raw)
    if df.empty:
        raise DataError(f"Price data for '{ticker}' was empty after cleaning.")

    # Patch the in-progress bar's close with a realtime quote (US only, no-op
    # otherwise) so "Harga sekarang" isn't ~15 min behind the market.
    rt = _realtime_close(ticker)
    if rt is not None:
        df.loc[df.index[-1], "Close"] = rt

    with _LOCK:
        _CACHE[key] = (now, df)

    return df


if __name__ == "__main__":
    # Self-check the realtime-override fail-soft paths (no network needed).
    _FINNHUB_KEY = ""  # no key -> always None
    assert _realtime_close("AAPL") is None
    _FINNHUB_KEY = "dummy"
    assert _realtime_close("BBCA.JK") is None  # IDX -> skipped, no call
    print("data.py self-check OK")
