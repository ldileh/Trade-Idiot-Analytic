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

# (ticker, interval, range, prepost, realtime) -> (fetched_at_epoch, dataframe)
_CACHE: dict[tuple[str, str, str, bool, bool], tuple[float, pd.DataFrame]] = {}
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


def _session_flags(idx: pd.DatetimeIndex) -> list[bool]:
    """True where a bar falls outside US regular hours (09:30–16:00 ET).

    yfinance returns tz-naive UTC for intraday bars; convert to US/Eastern and
    compare against the regular session. Pre/post bars are everything else on a
    weekday. (Daily+ bars never carry an extended session, so callers only ask
    this for intraday US tickers.)
    """
    et = idx.tz_localize("UTC").tz_convert("America/New_York")
    mins = et.hour * 60 + et.minute
    regular = (mins >= 9 * 60 + 30) & (mins < 16 * 60)
    return [not r for r in regular]


def get_ohlcv(
    ticker: str, interval: str, range_: str, prepost: bool = False, realtime: bool = True
) -> pd.DataFrame:
    """Fetch OHLCV for a ticker. Cached for `_CACHE_TTL_SECONDS`.

    With `prepost=True`, pre/post-market bars are included (US intraday only;
    Yahoo ignores it for IDX/daily) and an `Extended` bool column flags which
    bars fall outside regular hours. Without it, `Extended` is all-False.

    With `realtime=True` (default) the latest US bar's close is patched with a
    Finnhub realtime quote when a key is set; `realtime=False` forces the plain
    (delayed) Yahoo close. `df.attrs["source"]` reports which was used.

    Returns a DataFrame indexed by datetime with Open/High/Low/Close/Volume
    (+ Extended). Raises DataError if Yahoo returns nothing (e.g. unknown ticker).
    """
    ticker = ticker.strip().upper()
    if not ticker:
        raise DataError("Ticker must not be empty.")

    key = (ticker, interval, range_, prepost, realtime)
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
        prepost=prepost,
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

    # Flag extended-hours bars so the chart can mark them. Only meaningful for
    # US intraday with prepost; otherwise every bar is "regular".
    df["Extended"] = _session_flags(df.index) if prepost else False

    # Patch the in-progress bar's close with a realtime quote (US only, no-op
    # otherwise) so "Harga sekarang" isn't ~15 min behind the market. Record the
    # source so the UI can show where the latest price came from.
    rt = _realtime_close(ticker) if realtime else None
    if rt is not None:
        df.loc[df.index[-1], "Close"] = rt
    df.attrs["source"] = "finnhub" if rt is not None else "yahoo"

    with _LOCK:
        _CACHE[key] = (now, df)

    return df


if __name__ == "__main__":
    # Self-check the realtime-override fail-soft paths (no network needed).
    _FINNHUB_KEY = ""  # no key -> always None
    assert _realtime_close("AAPL") is None
    _FINNHUB_KEY = "dummy"
    assert _realtime_close("BBCA.JK") is None  # IDX -> skipped, no call

    # 14:00 & 21:00 UTC = 09:00 (pre) & 16:00 (post) ET on a winter weekday;
    # 15:00 UTC = 10:00 ET = regular.
    idx = pd.to_datetime(["2024-01-08 14:00", "2024-01-08 15:00", "2024-01-08 21:00"])
    assert _session_flags(idx) == [True, False, True]
    print("data.py self-check OK")
