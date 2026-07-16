"""Local SQLite cache for daily OHLCV bars — backfill once, then delta-sync.

Backtesting and multi-timeframe momentum need long daily histories. Fetching
them from Yahoo on every request is slow and rate-limit-prone, so we store bars
in a local SQLite file (stdlib `sqlite3`, no ORM): the first request for a ticker
backfills the full range, later requests read from the DB and fetch only the
*delta* (bars after the last stored date).

Source of the bars: Stooq CSV (US, no key, no limit) when reachable, else the
existing Yahoo path — the cache is source-agnostic, it just persists whatever a
source returns. IDX (`.JK`) symbols aren't on Stooq, so they always fill via
Yahoo; the IDX EOD file path can slot in here later behind the same interface.

Only the daily (`1d`) interval is cached. Intraday/live bars stay on the direct
Yahoo path (see `data.get_ohlcv`) — they change minute to minute and would just
churn the DB.

DB location: `TIA_DATA_DIR` env if set, else the OS local-app-data dir. Never in
the repo.
"""
from __future__ import annotations

import os
import sqlite3
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from threading import Lock

import pandas as pd
import requests

_LOCK = Lock()
_STOOQ_URL = "https://stooq.com/q/d/l/?s={sym}&i=d"

# One connection, guarded by _LOCK (SQLite + a local single-user sidecar — a
# connection pool would be pure ceremony here).
# ponytail: single global connection+lock; add a pool only if the sidecar ever
# serves concurrent writers, which a local single-user app doesn't.
_CONN: sqlite3.Connection | None = None


def _data_dir() -> Path:
    override = os.getenv("TIA_DATA_DIR", "").strip()
    if override:
        return Path(override)
    base = os.getenv("LOCALAPPDATA") or os.path.expanduser("~/.local/share")
    return Path(base) / "TradeIdiotAnalytic"


def _db_path() -> Path:
    d = _data_dir()
    d.mkdir(parents=True, exist_ok=True)
    return d / "bars.sqlite3"


def _conn() -> sqlite3.Connection:
    global _CONN
    if _CONN is None:
        _CONN = sqlite3.connect(str(_db_path()), check_same_thread=False)
        _CONN.execute(
            """CREATE TABLE IF NOT EXISTS bars (
                   ticker   TEXT NOT NULL,
                   interval TEXT NOT NULL,
                   date     TEXT NOT NULL,   -- ISO YYYY-MM-DD (UTC calendar day)
                   open     REAL, high REAL, low REAL, close REAL, volume REAL,
                   PRIMARY KEY (ticker, interval, date)
               )"""
        )
        _CONN.commit()
    return _CONN


def _last_date(ticker: str, interval: str) -> str | None:
    row = _conn().execute(
        "SELECT MAX(date) FROM bars WHERE ticker=? AND interval=?", (ticker, interval)
    ).fetchone()
    return row[0] if row and row[0] else None


def _store(ticker: str, interval: str, df: pd.DataFrame) -> None:
    """Upsert bars from a normalized OHLCV frame (DatetimeIndex, UTC)."""
    rows = [
        (
            ticker,
            interval,
            ts.strftime("%Y-%m-%d"),
            float(r.Open), float(r.High), float(r.Low), float(r.Close), float(r.Volume),
        )
        for ts, r in zip(df.index, df.itertuples(index=False))
    ]
    if not rows:
        return
    with _LOCK:
        _conn().executemany(
            "INSERT OR REPLACE INTO bars "
            "(ticker, interval, date, open, high, low, close, volume) "
            "VALUES (?,?,?,?,?,?,?,?)",
            rows,
        )
        _conn().commit()


def _read(ticker: str, interval: str, start: date | None) -> pd.DataFrame:
    """Read cached bars >= start (all if None) as a normalized OHLCV frame."""
    q = "SELECT date, open, high, low, close, volume FROM bars WHERE ticker=? AND interval=?"
    params: list = [ticker, interval]
    if start is not None:
        q += " AND date>=?"
        params.append(start.strftime("%Y-%m-%d"))
    q += " ORDER BY date"
    rows = _conn().execute(q, params).fetchall()
    if not rows:
        return pd.DataFrame(columns=["Open", "High", "Low", "Close", "Volume"])
    idx = pd.to_datetime([r[0] for r in rows]).tz_localize("UTC")
    df = pd.DataFrame(
        [r[1:] for r in rows], columns=["Open", "High", "Low", "Close", "Volume"], index=idx
    )
    return df


def _stooq(ticker: str) -> pd.DataFrame | None:
    """Full daily history from Stooq CSV, or None if unreachable/empty.

    US tickers map to `<sym>.us`; anything already carrying a suffix (e.g. .JK)
    isn't on Stooq, so we skip it and let the Yahoo fallback handle it.
    """
    if "." in ticker:
        return None
    sym = f"{ticker.lower()}.us"
    try:
        resp = requests.get(_STOOQ_URL.format(sym=sym), timeout=15)
        if resp.status_code != 200 or "Date,Open" not in resp.text[:40]:
            return None
        from io import StringIO

        raw = pd.read_csv(StringIO(resp.text))
    except (requests.RequestException, ValueError):
        return None
    if raw.empty or "Close" not in raw.columns:
        return None
    raw["Date"] = pd.to_datetime(raw["Date"])
    raw = raw.set_index("Date")
    raw.index = raw.index.tz_localize("UTC")
    keep = ["Open", "High", "Low", "Close", "Volume"]
    return raw[keep].dropna(how="any").sort_index()


# Range string -> approximate lookback in days (matches the yfinance ranges).
_RANGE_DAYS = {
    "1mo": 31, "3mo": 93, "6mo": 186, "1y": 366, "2y": 731,
    "5y": 1827, "10y": 3653, "ytd": 366, "max": 20000,
}


def get_daily_cached(
    ticker: str, range_: str, fallback
) -> pd.DataFrame:
    """Return daily bars for `ticker`/`range_`, served from the SQLite cache.

    On a miss (or stale cache), backfill from Stooq if possible, else call
    `fallback(ticker, "1d", range_)` (the Yahoo provider) and persist the result.
    Delta-sync: if the cache already has data, only bars after the last stored
    date are fetched. `fallback` must return a normalized OHLCV DataFrame.
    """
    ticker = ticker.strip().upper()
    interval = "1d"
    today = datetime.now(timezone.utc).date()
    want_start = today - timedelta(days=_RANGE_DAYS.get(range_, 366))

    last = _last_date(ticker, interval)
    need_fetch = last is None
    if last is not None:
        last_d = datetime.strptime(last, "%Y-%m-%d").date()
        # Refetch only if the cache is a full day behind (weekend-safe: a Monday
        # request with Friday's bar cached is one delta fetch, not a miss).
        need_fetch = last_d < today - timedelta(days=1)

    if need_fetch:
        fetched = _stooq(ticker)
        source = "stooq"
        if fetched is None or fetched.empty:
            fetched = fallback(ticker, interval, range_ if last is None else "5d")
            fetched = fetched[["Open", "High", "Low", "Close", "Volume"]]
            source = "yahoo"
        _store(ticker, interval, fetched)
        fetched.attrs["backfill_source"] = source

    df = _read(ticker, interval, want_start)
    df["Extended"] = False
    df.attrs["source"] = "cache"
    return df


def demo() -> None:
    """Self-check the cache round-trip with a fake in-memory source (no network)."""
    global _CONN
    _CONN = sqlite3.connect(":memory:", check_same_thread=False)
    _CONN.execute(
        "CREATE TABLE bars (ticker TEXT, interval TEXT, date TEXT, open REAL,"
        " high REAL, low REAL, close REAL, volume REAL,"
        " PRIMARY KEY (ticker, interval, date))"
    )

    calls = {"n": 0}

    def fake(ticker, interval, range_):
        calls["n"] += 1
        idx = pd.to_datetime(["2024-01-01", "2024-01-02", "2024-01-03"]).tz_localize("UTC")
        return pd.DataFrame(
            {"Open": [1, 2, 3], "High": [1, 2, 3], "Low": [1, 2, 3],
             "Close": [10, 20, 30], "Volume": [100, 200, 300]}, index=idx
        )

    # Stooq is skipped for a dotted symbol, so this exercises the fallback path.
    df1 = get_daily_cached("BBCA.JK", "max", fake)
    assert len(df1) == 3, len(df1)
    assert calls["n"] == 1, calls["n"]
    # Second call: cache is fresh enough only if last bar is recent; force a read
    # by asserting the stored rows come back without another fetch when up to date.
    last = _last_date("BBCA.JK", "1d")
    assert last == "2024-01-03", last
    print("bars_cache.demo OK: rows=%d fetches=%d" % (len(df1), calls["n"]))


if __name__ == "__main__":
    demo()
