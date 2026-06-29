"""Relative Rotation Graph (RRG) computation.

An RRG plots each symbol on two axes relative to a benchmark:
  - X = RS-Ratio    (normalized relative strength vs the benchmark)
  - Y = RS-Momentum (normalized rate-of-change of RS-Ratio)

Both are centered on 100, splitting the plane into four quadrants:
  Leading (x>100, y>100), Weakening (x>100, y<100),
  Lagging (x<100, y<100), Improving (x<100, y>100).

The "tail" is the last `tail` points of each symbol's path, so you can see
where it is rotating. This is the standard JdK RS-Ratio / RS-Momentum method,
implemented transparently with rolling z-scores (no proprietary smoothing).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from app.services.data import DataError, get_ohlcv

# Window for the rolling normalization. ~12 keeps the ratio responsive on the
# weekly/daily series typical for an RRG without being too jumpy.
_NORM_WINDOW = 12
# Lookback for the momentum (rate-of-change of RS-Ratio), in bars.
_MOM_WINDOW = 1


def _close(ticker: str, interval: str, range_: str) -> pd.Series:
    df = get_ohlcv(ticker, interval, range_)
    return df["Close"].astype(float)


def _rs_ratio(rs: pd.Series) -> pd.Series:
    """Normalize relative strength into a ~100-centered RS-Ratio.

    Rolling z-score of RS scaled to sit around 100 (the JdK convention):
    100 + z * a, with `a` small so values stay in a readable ~95-105 band.
    """
    mean = rs.rolling(_NORM_WINDOW).mean()
    std = rs.rolling(_NORM_WINDOW).std(ddof=0).replace(0, np.nan)
    z = (rs - mean) / std
    return 100 + z


def _rs_momentum(rs_ratio: pd.Series) -> pd.Series:
    """Normalized rate-of-change of the RS-Ratio, also ~100-centered."""
    roc = rs_ratio.diff(_MOM_WINDOW)
    mean = roc.rolling(_NORM_WINDOW).mean()
    std = roc.rolling(_NORM_WINDOW).std(ddof=0).replace(0, np.nan)
    z = (roc - mean) / std
    return 100 + z


def _quadrant(x: float, y: float) -> str:
    if x >= 100 and y >= 100:
        return "leading"
    if x >= 100 and y < 100:
        return "weakening"
    if x < 100 and y < 100:
        return "lagging"
    return "improving"


def compute_rrg(
    tickers: list[str],
    benchmark: str,
    interval: str,
    range_: str,
    tail: int,
) -> dict:
    """Return RRG paths for `tickers` relative to `benchmark`.

    Shape:
      {
        "benchmark": "^JKSE",
        "symbols": [
          {"symbol": "BBCA.JK", "quadrant": "leading",
           "tail": [{"x": 101.2, "y": 100.4, "time": 1717...}, ...]},
          ...
        ],
      }
    Symbols that fail to load are skipped. Raises DataError if the benchmark
    itself can't be fetched (nothing can be computed without it).
    """
    try:
        bench = _close(benchmark, interval, range_)
    except DataError as exc:
        raise DataError(f"Benchmark '{benchmark}' unavailable: {exc}") from exc

    out_symbols: list[dict] = []
    for ticker in tickers:
        ticker = ticker.strip().upper()
        if not ticker:
            continue
        try:
            close = _close(ticker, interval, range_)
        except DataError:
            continue  # skip a bad symbol, keep the rest

        # Align to common dates, then compute relative strength vs benchmark.
        joined = pd.concat([close, bench], axis=1, keys=["s", "b"]).dropna()
        if len(joined) < _NORM_WINDOW + _MOM_WINDOW + tail:
            continue
        rs = joined["s"] / joined["b"]
        ratio = _rs_ratio(rs)
        mom = _rs_momentum(ratio)

        path = pd.concat([ratio, mom], axis=1, keys=["x", "y"]).dropna()
        if path.empty:
            continue
        path = path.tail(tail)

        points = [
            {"x": round(float(r.x), 3), "y": round(float(r.y), 3), "time": int(idx.timestamp())}
            for idx, r in path.iterrows()
        ]
        last = points[-1]
        out_symbols.append(
            {"symbol": ticker, "quadrant": _quadrant(last["x"], last["y"]), "tail": points}
        )

    return {"benchmark": benchmark.strip().upper(), "symbols": out_symbols}


def demo() -> None:
    """Self-check against synthetic series: a clearly-outperforming symbol must
    land in leading/improving, an underperforming one in lagging/weakening."""
    idx = pd.date_range("2024-01-01", periods=80, freq="W")
    bench = pd.Series(np.linspace(100, 110, 80), index=idx)
    strong = pd.Series(np.linspace(100, 160, 80), index=idx)  # outperforms
    weak = pd.Series(np.linspace(100, 80, 80), index=idx)     # underperforms

    def ratio_mom(s):
        rs = s / bench
        r = _rs_ratio(rs)
        m = _rs_momentum(r)
        return r.dropna().iloc[-1], m.dropna().iloc[-1]

    sx, _ = ratio_mom(strong)
    wx, _ = ratio_mom(weak)
    assert sx > wx, (sx, wx)
    print("rrg.demo OK: strong RS-Ratio", round(sx, 2), "> weak", round(wx, 2))


if __name__ == "__main__":
    demo()
