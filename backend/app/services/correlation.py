"""Saham yang Gerak Bareng — daily-return correlation of one symbol vs peers.

Context for a symbol/position: which other stocks usually move up and down with
it (its sector) and which move opposite. Pearson correlation of ~6 months of
daily returns, computed from cached OHLCV (task 013) via pandas — no extra API
calls beyond warming each peer's daily cache once.

Returns the strongest same-direction and opposite-direction peers with a
plain-language strength (Kuat/Sedang/Lemah) instead of a raw coefficient. When a
symbol has too little overlapping history (new listing / empty cache), it's
reported as 'belum cukup data'.
"""
from __future__ import annotations

import pandas as pd

from app.services.provider import get_provider

_MIN_OVERLAP = 40  # need at least ~2 months of shared trading days to trust a corr


def _returns(ticker: str) -> pd.Series | None:
    try:
        df = get_provider("prices").get_historical(ticker, "1d", "6mo")
    except Exception:  # noqa: BLE001 — a missing peer just drops out
        return None
    close = df["Close"].astype(float)
    if len(close) < _MIN_OVERLAP:
        return None
    return close.pct_change().dropna().rename(ticker.strip().upper())


def _strength(c: float) -> str:
    a = abs(c)
    if a >= 0.7:
        return "Kuat"
    if a >= 0.4:
        return "Sedang"
    return "Lemah"


def correlate(ticker: str, peers: list[str], top: int = 5) -> dict:
    """Correlation of `ticker` vs each peer. Returns most same-direction and most
    opposite peers (word strength, not raw numbers)."""
    base_sym = ticker.strip().upper()
    base = _returns(base_sym)
    if base is None:
        return {"ticker": base_sym, "enough_data": False, "same": [], "opposite": []}

    rows: list[dict] = []
    for p in peers:
        sym = p.strip().upper()
        if not sym or sym == base_sym:
            continue
        r = _returns(sym)
        if r is None:
            continue
        joined = pd.concat([base, r], axis=1, join="inner").dropna()
        if len(joined) < _MIN_OVERLAP:
            continue
        c = float(joined.iloc[:, 0].corr(joined.iloc[:, 1]))
        if pd.isna(c):
            continue
        rows.append({"sym": sym, "corr": round(c, 2), "strength": _strength(c)})

    if not rows:
        return {"ticker": base_sym, "enough_data": False, "same": [], "opposite": []}

    rows.sort(key=lambda x: x["corr"], reverse=True)
    same = [r for r in rows if r["corr"] > 0][:top]
    opposite = [r for r in rows if r["corr"] < 0]
    opposite.sort(key=lambda x: x["corr"])  # most negative first
    opposite = opposite[:top]
    return {"ticker": base_sym, "enough_data": True, "same": same, "opposite": opposite}


def demo() -> None:
    """Live self-check: IDX banks should correlate strongly with each other."""
    out = correlate("BBCA.JK", ["BBRI.JK", "BMRI.JK", "TLKM.JK"], top=5)
    assert out["enough_data"], out
    # At least one same-direction peer with a real coefficient.
    assert out["same"], out
    top = out["same"][0]
    assert -1 <= top["corr"] <= 1
    print("correlation.demo OK:", [(r["sym"], r["corr"], r["strength"]) for r in out["same"]])


if __name__ == "__main__":
    demo()
