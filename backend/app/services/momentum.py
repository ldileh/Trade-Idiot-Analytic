"""Multi-timeframe momentum — "Kekuatan Tren" over 1 / 3 / 6 months.

Three separate formation-period returns instead of one RSI/Stochastic reading
(Jegadeesh & Titman momentum): whether a trend is fresh or long-running shows up
as the 1mo number leading vs all three moving together. Plus a volume
confirmation ("Minat Beli") from OBV slope, because MA-crossover trend signals
alone have decayed out-of-sample since the 1990s (see PLAN.md §2) — a price move
backed by rising OBV is more trustworthy than price alone.

Computed from cached daily OHLCV (task 013) — no extra API calls.
"""
from __future__ import annotations

import pandas as pd
from ta.volume import OnBalanceVolumeIndicator

# Approximate trading days per calendar period.
_PERIODS = {"1 Bulan": 21, "3 Bulan": 63, "6 Bulan": 126}


def _direction(pct: float) -> str:
    if pct >= 2.0:
        return "naik"
    if pct <= -2.0:
        return "turun"
    return "datar"


def compute(df: pd.DataFrame) -> dict:
    """Return per-period momentum + a volume-confirmation read from an OHLCV
    frame. Reports 'belum cukup data' when the history is too short."""
    close = df["Close"].astype(float)
    n = len(close)

    readings = []
    for label, days in _PERIODS.items():
        if n <= days:
            readings.append({"label": label, "pct": None, "direction": None, "enough_data": False})
            continue
        past = float(close.iloc[-days - 1])
        now = float(close.iloc[-1])
        pct = (now / past - 1.0) * 100 if past else 0.0
        readings.append({
            "label": label,
            "pct": round(pct, 1),
            "direction": _direction(pct),
            "enough_data": True,
        })

    # Volume confirmation: OBV rising over the last ~1mo backs an up-move.
    # ponytail: OBV slope sign is enough for a beginner "Minat Beli" read;
    # upgrade to VWAP-distance if we ever need magnitude, not just direction.
    volume_ok = None
    volume_text = "belum cukup data"
    if n > 21:
        obv = OnBalanceVolumeIndicator(close, df["Volume"].astype(float)).on_balance_volume()
        recent = obv.iloc[-21:]
        rising = float(recent.iloc[-1]) > float(recent.iloc[0])
        volume_ok = bool(rising)
        volume_text = (
            "Minat Beli kuat — kenaikan didukung banyak transaksi (OBV naik)."
            if rising
            else "Minat Beli lemah — volume tidak mendukung, hati-hati sinyal palsu."
        )

    judged = [r for r in readings if r["enough_data"]]
    if not judged:
        headline = "Belum cukup data harga untuk menilai kekuatan tren."
    else:
        ups = sum(1 for r in judged if r["direction"] == "naik")
        downs = sum(1 for r in judged if r["direction"] == "turun")
        if ups == len(judged):
            headline = "Tren naik di semua jangka — momentum kuat & sudah berjalan."
        elif downs == len(judged):
            headline = "Tren turun di semua jangka — tekanan jual dominan."
        elif judged[0]["direction"] == "naik" and downs:
            headline = "Baru berbalik naik (kuat di 1 bulan, jangka panjang belum ikut)."
        else:
            headline = "Tren campuran antar jangka — arah belum solid."

    return {
        "readings": readings,
        "volume_ok": volume_ok,
        "volume_text": volume_text,
        "headline": headline,
    }


def demo() -> None:
    """Self-check on a synthetic steady uptrend: all three periods positive."""
    import numpy as np

    idx = pd.date_range("2024-01-01", periods=200, freq="D", tz="UTC")
    close = pd.Series(np.linspace(100, 200, 200), index=idx)
    df = pd.DataFrame({"Close": close, "Volume": np.linspace(1000, 3000, 200)}, index=idx)
    out = compute(df)
    assert all(r["direction"] == "naik" for r in out["readings"]), out["readings"]
    assert out["volume_ok"] is True, out
    print("momentum.demo OK:", out["headline"])


if __name__ == "__main__":
    demo()
