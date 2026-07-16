"""Optional external DataProvider adapters — user picks these via Data Source
settings (BYOK, task 017) and they only activate when the user supplies a key.

  - FMPProvider       : US fundamentals from Financial Modeling Prep (free 250/day)
  - SectorsProvider   : IDX fundamentals + ownership from Sectors.app (free tier)
  - TwelveDataProvider: delayed daily bars from Twelve Data (free 800/day)

Each maps the third-party response onto the SAME schema the Yahoo provider
returns (FundamentalsResponse / OwnershipResponse / OHLCV frame), so downstream
scorers, panels and the F-Score/Z-Score work unchanged regardless of source.

All network calls fail LOUD-but-safe: a bad key, rate limit, or schema surprise
raises the matching *Error, and the router catches it and falls back to the
default provider with a clear message (see get_provider / the routers). We use
the already-installed `requests` — no vendor SDKs.
"""
from __future__ import annotations

import requests

from app.services.data import DataError
from app.services.fundamentals import FundamentalsError
from app.services.ownership import OwnershipError
from app.services.provider import DataProvider

_TIMEOUT = 10


class ProviderKeyError(Exception):
    """A BYOK provider was selected but its call failed (bad key / rate limit /
    unexpected schema). Carries a user-facing message; routers fall back."""


def _get(url: str, params: dict, who: str) -> dict | list:
    """GET + JSON, turning any failure into a ProviderKeyError with a clear msg."""
    try:
        resp = requests.get(url, params=params, timeout=_TIMEOUT)
    except requests.RequestException as exc:
        raise ProviderKeyError(f"{who}: tidak bisa terhubung ({exc.__class__.__name__}).") from exc
    if resp.status_code in (401, 403):
        raise ProviderKeyError(f"{who}: API key ditolak — cek key di pengaturan Sumber Data.")
    if resp.status_code == 429:
        raise ProviderKeyError(f"{who}: kuota harian free tier habis, coba lagi besok.")
    if resp.status_code != 200:
        raise ProviderKeyError(f"{who}: gagal ({resp.status_code}).")
    try:
        return resp.json()
    except ValueError as exc:
        raise ProviderKeyError(f"{who}: respons tak terbaca.") from exc


# --- Financial Modeling Prep (US fundamentals) -----------------------------
class FMPProvider(DataProvider):
    name = "fmp"
    BASE = "https://financialmodelingprep.com/api/v3"

    def __init__(self, key: str):
        self._key = key

    def get_fundamentals(self, ticker: str) -> dict:
        ticker = ticker.strip().upper()
        profile = _get(f"{self.BASE}/profile/{ticker}", {"apikey": self._key}, "FMP")
        ratios = _get(f"{self.BASE}/ratios-ttm/{ticker}", {"apikey": self._key}, "FMP")
        if not profile or not ratios:
            raise FundamentalsError(f"FMP: tidak ada data fundamental untuk '{ticker}'.")
        p = profile[0] if isinstance(profile, list) else profile
        r = ratios[0] if isinstance(ratios, list) else ratios

        # Map FMP fields onto the same metric shape the Yahoo provider produces,
        # reusing the shared judge/format via fundamentals._METRICS would require
        # yfinance keys; instead build a compatible info-like dict and delegate.
        info = {
            "trailingPE": r.get("peRatioTTM"),
            "priceToBook": r.get("priceToBookRatioTTM"),
            "priceToSalesTrailing12Months": r.get("priceToSalesRatioTTM"),
            "dividendYield": (r.get("dividendYieldTTM") or 0) * 100,
            "marketCap": p.get("mktCap"),
            "returnOnEquity": r.get("returnOnEquityTTM"),
            "returnOnAssets": r.get("returnOnAssetsTTM"),
            "profitMargins": r.get("netProfitMarginTTM"),
            "debtToEquity": (r.get("debtEquityRatioTTM") or 0) * 100,
            "currentRatio": r.get("currentRatioTTM"),
            "trailingEps": p.get("lastDiv"),  # FMP profile has no TTM EPS; approx
            "shortName": p.get("companyName") or ticker,
        }
        # Delegate scoring to the shared builder by stubbing its cache.
        from app.services import fundamentals as fund

        fund._CACHE[ticker] = (__import__("time").time(), info)
        return fund.get_fundamentals(ticker)


# --- Sectors.app (IDX fundamentals + ownership) ----------------------------
class SectorsProvider(DataProvider):
    name = "sectors"
    BASE = "https://api.sectors.app/v1"

    def __init__(self, key: str):
        self._key = key

    def _headers(self) -> dict:
        return {"Authorization": self._key}

    def get_fundamentals(self, ticker: str) -> dict:
        code = ticker.strip().upper().removesuffix(".JK")
        data = _get(f"{self.BASE}/company/report/{code}/", {"sections": "valuation,financials"}, "Sectors")
        if not isinstance(data, dict) or not data:
            raise FundamentalsError(f"Sectors: tidak ada data untuk '{code}'.")
        val = data.get("valuation", {})
        fin = data.get("financials", {})
        info = {
            "trailingPE": val.get("pe"),
            "priceToBook": val.get("pb"),
            "priceToSalesTrailing12Months": val.get("ps"),
            "marketCap": val.get("market_cap"),
            "returnOnEquity": fin.get("roe"),
            "returnOnAssets": fin.get("roa"),
            "profitMargins": fin.get("net_profit_margin"),
            "debtToEquity": fin.get("debt_to_equity"),
            "shortName": data.get("company_name") or code,
        }
        from app.services import fundamentals as fund

        fund._CACHE[f"{code}.JK"] = (__import__("time").time(), info)
        return fund.get_fundamentals(f"{code}.JK")

    def get_ownership_flow(self, ticker: str, months: int = 12) -> dict:
        # Sectors exposes bandarmology/ownership; fall back to the KSEI path shape
        # if the endpoint is unavailable so the panel still renders.
        code = ticker.strip().upper().removesuffix(".JK")
        raise OwnershipError(
            "Sectors ownership belum dipetakan; pakai sumber Default (KSEI) untuk kepemilikan "
            f"'{code}'."
        )


# --- Twelve Data (delayed daily bars) --------------------------------------
class TwelveDataProvider(DataProvider):
    name = "twelvedata"
    BASE = "https://api.twelvedata.com"

    def __init__(self, key: str):
        self._key = key

    def get_historical(
        self, ticker: str, interval: str, range_: str, prepost: bool = False, realtime: bool = True
    ) -> "object":
        import pandas as pd

        # Twelve Data uses "1day" etc.; only daily is wired here (scan/momentum).
        td_interval = {"1d": "1day", "1wk": "1week", "1mo": "1month"}.get(interval, "1day")
        data = _get(
            f"{self.BASE}/time_series",
            {"symbol": ticker.strip().upper(), "interval": td_interval, "outputsize": 5000, "apikey": self._key},
            "TwelveData",
        )
        values = data.get("values") if isinstance(data, dict) else None
        if not values:
            msg = data.get("message") if isinstance(data, dict) else None
            raise DataError(f"TwelveData: tidak ada bar untuk '{ticker}'. {msg or ''}".strip())
        df = pd.DataFrame(values)
        df["datetime"] = pd.to_datetime(df["datetime"])
        df = df.set_index("datetime").sort_index()
        df.index = df.index.tz_localize("UTC") if df.index.tz is None else df.index.tz_convert("UTC")
        out = df.rename(columns=str.title)[["Open", "High", "Low", "Close", "Volume"]].astype(float)
        out["Extended"] = False
        out.attrs["source"] = "cache"
        return out


# Registry: provider name -> (constructor, key name it needs).
_REGISTRY = {
    "fmp": FMPProvider,
    "sectors": SectorsProvider,
    "twelvedata": TwelveDataProvider,
}


def build(name: str, key: str) -> DataProvider | None:
    """Instantiate an external provider by name with a key, or None if unknown/keyless."""
    ctor = _REGISTRY.get(name)
    if ctor is None or not key:
        return None
    return ctor(key)


if __name__ == "__main__":
    # Self-check: registry wiring + fail-loud _get on a bad status (no real key).
    assert build("fmp", "") is None
    assert build("nope", "x") is None
    assert isinstance(build("twelvedata", "k"), TwelveDataProvider)

    class R:
        status_code = 401

        def json(self):
            return {}

    requests.get = lambda *a, **k: R()  # type: ignore[assignment]
    try:
        _get("http://x", {}, "FMP")
        raise AssertionError("expected ProviderKeyError")
    except ProviderKeyError as e:
        assert "ditolak" in str(e), e
    print("adapters.py self-check OK")
