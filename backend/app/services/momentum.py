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


# --- 52-week high proximity (George & Hwang 2004) ---------------------------
# "The 52-Week High and Momentum Investing", Journal of Finance 59(5):2145-2176.
# Nearness to the 52-week high predicts future returns and *dominates* past
# returns as a predictor; the effect replicates internationally (18 of 20 markets
# positive, 10 significantly so — Du 2008 / Marshall & Cahan). The behavioural
# story is anchoring: investors treat the 52-week high as a reference point and
# under-react to good news when price sits near it.
#
# We report the raw position rather than a buy signal: near-high means "the
# anchor effect is in play", NOT "beli sekarang". A stock can sit near its high
# all the way down a reversal.
_NEAR_HIGH = 0.95   # within 5% of the 52w high
_NEAR_LOW = 0.20    # within the bottom 20% of the 52w range


def _fifty_two_week(df: pd.DataFrame) -> dict:
    """Where the latest close sits inside the 52-week high/low range.

    `pct_of_high` = close / 52w-high (the George & Hwang measure). `range_pos`
    = 0..1 position between the 52w low and high, which is what the visual bar
    renders. Needs ~6 months of bars before the range means anything.
    """
    # Use High/Low when present so the range matches what a chart shows; some
    # cached frames only carry Close, so fall back to it rather than fail.
    high_src = df["High"] if "High" in df else df["Close"]
    low_src = df["Low"] if "Low" in df else df["Close"]
    close = df["Close"].astype(float)
    n = len(close)
    if n < 126:  # < ~6 months: a "52-week" range would be misleading
        return {"enough_data": False, "pct_of_high": None, "range_pos": None,
                "high": None, "low": None, "zone": None, "text": "belum cukup data"}

    window = min(n, 252)  # ~1 trading year
    hi = float(high_src.astype(float).iloc[-window:].max())
    lo = float(low_src.astype(float).iloc[-window:].min())
    now = float(close.iloc[-1])
    if hi <= 0 or hi <= lo:
        return {"enough_data": False, "pct_of_high": None, "range_pos": None,
                "high": None, "low": None, "zone": None, "text": "belum cukup data"}

    pct_of_high = now / hi
    range_pos = (now - lo) / (hi - lo)

    if pct_of_high >= _NEAR_HIGH:
        zone = "near_high"
        text = (
            "Harga menempel di puncak 52 minggu. Riset George & Hwang (2004) menemukan "
            "saham di dekat puncaknya cenderung melanjutkan penguatan — investor memakai "
            "puncak lama sebagai 'jangkar' dan telat bereaksi pada kabar baik. "
            "Bukan jaminan: dekat puncak juga berarti sudah naik banyak."
        )
    elif range_pos <= _NEAR_LOW:
        zone = "near_low"
        text = (
            "Harga ada di dasar rentang 52 minggu. Secara historis kelompok ini justru "
            "cenderung tertinggal, bukan langsung memantul — 'murah' belum tentu bagus. "
            "Butuh alasan kuat lain sebelum masuk."
        )
    else:
        zone = "middle"
        text = (
            "Harga di tengah rentang 52 minggu — tidak dekat puncak, tidak di dasar. "
            "Efek jangkar puncak 52 minggu tidak menonjol di posisi ini."
        )

    return {
        "enough_data": True,
        "pct_of_high": round(pct_of_high * 100, 1),
        "range_pos": round(range_pos * 100, 1),
        "high": hi,
        "low": lo,
        "zone": zone,
        "text": text,
    }


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
        "week52": _fifty_two_week(df),
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

    # 52-week high: a steady uptrend ends exactly AT its own high.
    w = out["week52"]
    assert w["enough_data"] and w["zone"] == "near_high", w
    assert w["pct_of_high"] == 100.0, w
    assert w["range_pos"] == 100.0, w

    # A steady downtrend ends at the bottom of its range.
    down = pd.DataFrame(
        {"Close": pd.Series(np.linspace(200, 100, 200), index=idx), "Volume": np.full(200, 1000.0)},
        index=idx,
    )
    w = compute(down)["week52"]
    assert w["zone"] == "near_low", w
    assert w["range_pos"] == 0.0, w

    # Short history must not fake a 52-week range.
    short_idx = pd.date_range("2024-01-01", periods=60, freq="D", tz="UTC")
    short = pd.DataFrame(
        {"Close": pd.Series(np.linspace(100, 120, 60), index=short_idx), "Volume": np.full(60, 1000.0)},
        index=short_idx,
    )
    assert compute(short)["week52"]["enough_data"] is False

    # High/Low columns are used for the range when present (wider than Close).
    with_hl = df.assign(High=df["Close"] * 1.10, Low=df["Close"] * 0.90)
    w = compute(with_hl)["week52"]
    assert w["high"] > float(df["Close"].max()), w  # range came from High, not Close
    assert w["zone"] == "middle", w  # last close sits below that wider high

    print("momentum.demo OK:", out["headline"], "| 52w:", out["week52"]["zone"])


if __name__ == "__main__":
    demo()
