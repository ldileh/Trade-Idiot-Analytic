"""OHLCV data retrieval via yfinance, with a small in-process TTL cache.

yfinance hits Yahoo Finance over the network; caching avoids re-downloading the
same ticker/interval/range within a short window while the user tweaks indicator
or backtest parameters on the same data.
"""
from __future__ import annotations

import time
from threading import Lock

import pandas as pd
import yfinance as yf

# (ticker, interval, range) -> (fetched_at_epoch, dataframe)
_CACHE: dict[tuple[str, str, str], tuple[float, pd.DataFrame]] = {}
_CACHE_TTL_SECONDS = 60.0
_LOCK = Lock()


class DataError(Exception):
    """Raised when no usable price data could be retrieved for a ticker."""


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

    with _LOCK:
        _CACHE[key] = (now, df)

    return df
