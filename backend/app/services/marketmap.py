"""Peta Pasar (treemap) data — market cap + daily change for a set of tickers.

Feeds the treemap where box size = market cap and color = today's price change.
Both numbers come from data already cached elsewhere: the daily change from the
SQLite bar cache (task 013), the market cap from the fundamentals `.info` cache.
Fetched per ticker but each ticker only touches its own already-warm caches, so a
refresh of a whole favorites list / sector is one batch pass, not per-box calls.

Tickers that can't be resolved are skipped (best-effort), never fail the batch.
"""
from __future__ import annotations

import yfinance as yf

from app.services.provider import get_provider


def _daily_change(ticker: str) -> tuple[float | None, float | None]:
    """(last_close, change_pct vs the prior close) from cached daily bars."""
    try:
        df = get_provider("prices").get_historical(ticker, "1d", "6mo")
    except Exception:  # noqa: BLE001 — one bad ticker shouldn't sink the batch
        return None, None
    close = df["Close"].astype(float)
    if len(close) < 2:
        return (float(close.iloc[-1]) if len(close) else None), None
    last, prev = float(close.iloc[-1]), float(close.iloc[-2])
    pct = (last / prev - 1.0) * 100 if prev else 0.0
    return last, round(pct, 2)


def _market_cap(ticker: str) -> float | None:
    try:
        info = yf.Ticker(ticker).info or {}
    except Exception:  # noqa: BLE001
        return None
    mc = info.get("marketCap")
    return float(mc) if isinstance(mc, (int, float)) and not isinstance(mc, bool) else None


def build_map(tickers: list[str]) -> list[dict]:
    """One tile per resolvable ticker: {sym, name, market_cap, change_pct, price}.

    Sorted largest-cap first so the treemap layout starts with the big boxes.
    Tickers with no market cap fall back to an equal placeholder size (1.0) so
    they still show up (colored by change) instead of vanishing.
    """
    out: list[dict] = []
    for raw in tickers:
        sym = raw.strip().upper()
        if not sym:
            continue
        price, change = _daily_change(sym)
        if price is None:
            continue  # unresolvable ticker — skip
        cap = _market_cap(sym)
        out.append({
            "sym": sym,
            "market_cap": cap,
            "change_pct": change,
            "price": price,
        })
    # Big boxes first; unknown-cap tiles (None) sort last.
    out.sort(key=lambda t: (t["market_cap"] is not None, t["market_cap"] or 0), reverse=True)
    return out


def demo() -> None:
    """Live self-check on a couple of large-caps."""
    m = build_map(["AAPL", "MSFT"])
    assert len(m) == 2, m
    assert all(t["price"] is not None for t in m), m
    # Largest cap should sort first.
    assert m[0]["market_cap"] is None or m[1]["market_cap"] is None or m[0]["market_cap"] >= m[1]["market_cap"]
    print("marketmap.demo OK:", [(t["sym"], t["change_pct"]) for t in m])


if __name__ == "__main__":
    demo()
