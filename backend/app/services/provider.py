"""`DataProvider` abstraction — one interface, many sources.

Lets a data source be swapped per feature and per user (basis for tasks 013,
017, 018) without touching the routers. The default `YahooProvider` wraps the
existing yfinance/Finnhub/KSEI service functions verbatim, so endpoint responses
are byte-for-byte unchanged; new providers just implement the same four methods.

Routers call `get_provider(...)` and use the returned instance. Today selection
is trivial (always Yahoo); task 017 threads the user's per-feature choice here.
"""
from __future__ import annotations

import pandas as pd

from app.services import bars_cache
from app.services import fundamentals as _fundamentals
from app.services import ownership as _ownership
from app.services.data import get_ohlcv

# Daily ranges long enough that a bulk backfill + SQLite cache beats re-fetching
# from Yahoo every time (backtesting / momentum). Short ranges and intraday stay
# on the live Yahoo path — they change too fast to cache.
_CACHED_RANGES = {"3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"}


class DataProvider:
    """Base interface. Each method may raise the matching service error.

    A provider need not implement every method — a source that only serves
    prices leaves the rest raising NotImplementedError, and the selector routes
    each feature to a provider that supports it.
    """

    name = "base"

    def get_historical(
        self,
        ticker: str,
        interval: str,
        range_: str,
        prepost: bool = False,
        realtime: bool = True,
    ) -> pd.DataFrame:
        """OHLCV bars as a DataFrame (see `data.get_ohlcv` for the contract)."""
        raise NotImplementedError

    def get_quote(self, ticker: str) -> float | None:
        """Latest price for a ticker, or None if unavailable."""
        raise NotImplementedError

    def get_fundamentals(self, ticker: str) -> dict:
        """Fundamentals payload (see `fundamentals.get_fundamentals`)."""
        raise NotImplementedError

    def get_ownership_flow(self, ticker: str, months: int = 12) -> dict:
        """Ownership composition/series (see `ownership.get_ownership`)."""
        raise NotImplementedError


class YahooProvider(DataProvider):
    """Default provider: yfinance prices (+ Finnhub realtime patch), yfinance
    fundamentals, KSEI ownership. Pure delegation to the existing services."""

    name = "yahoo"

    def get_historical(
        self,
        ticker: str,
        interval: str,
        range_: str,
        prepost: bool = False,
        realtime: bool = True,
    ) -> pd.DataFrame:
        # Long daily histories go through the SQLite bar cache (backfill once,
        # delta-sync after) so backtests/momentum don't re-download every time.
        # Live/intraday and short ranges use the direct Yahoo path unchanged.
        if interval == "1d" and range_ in _CACHED_RANGES and not prepost:
            return bars_cache.get_daily_cached(ticker, range_, self._fetch_daily)
        return get_ohlcv(ticker, interval, range_, prepost, realtime)

    @staticmethod
    def _fetch_daily(ticker: str, interval: str, range_: str) -> pd.DataFrame:
        """Backfill source for the cache: plain (delayed) daily Yahoo bars."""
        return get_ohlcv(ticker, interval, range_, prepost=False, realtime=False)

    def get_quote(self, ticker: str) -> float | None:
        df = get_ohlcv(ticker, "1d", "5d")
        return float(df["Close"].iloc[-1]) if not df.empty else None

    def get_fundamentals(self, ticker: str) -> dict:
        return _fundamentals.get_fundamentals(ticker)

    def get_ownership_flow(self, ticker: str, months: int = 12) -> dict:
        data = _ownership.get_ownership(ticker, months)
        data["top_holders"] = _ownership.top_holders(ticker)
        return data


_DEFAULT = YahooProvider()


def get_provider(feature: str | None = None, name: str | None = None) -> DataProvider:
    """Return the provider for a feature/request.

    `feature` is the capability being served ("prices" | "fundamentals" |
    "ownership"); `name` optionally forces a specific provider. Today only the
    default Yahoo provider exists, so both are accepted and ignored — task 017/018
    wire user selection in here without changing any caller.
    """
    return _DEFAULT


if __name__ == "__main__":
    # Self-check: the default provider exposes all four methods and delegates.
    p = get_provider("prices")
    assert isinstance(p, YahooProvider)
    for m in ("get_historical", "get_quote", "get_fundamentals", "get_ownership_flow"):
        assert callable(getattr(p, m))
    assert DataProvider().name == "base"
    print("provider.py self-check OK")
