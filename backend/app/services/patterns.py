"""Lightweight chart-pattern detection used as a trading-decision input.

These are the classic, internationally-known technical patterns (trend, moving-
average crosses, double top/bottom, head & shoulders, breakouts, RSI extremes)
detected with simple, transparent heuristics on the OHLCV frame. The goal is
educational signal, not a guarantee — every pattern returns plain-Indonesian
copy so a beginner understands what it implies for buying/selling.

Each detector appends a dict: {key, label, kind, summary, detail, at} where
`kind` is "bullish" | "bearish" | "neutral" and `at` is the Unix time (seconds)
of the most relevant bar, used to drop a marker on the chart (or None).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

Pattern = dict  # {key,label,kind,summary,detail,at}


def _epoch(index: pd.DatetimeIndex, i: int) -> int:
    return int(index[i].timestamp())


def _pivots(values: np.ndarray, kind: str, order: int = 3) -> list[int]:
    """Indices of strict local maxima ("high") / minima ("low")."""
    out: list[int] = []
    n = len(values)
    for i in range(order, n - order):
        window = values[i - order : i + order + 1]
        v = values[i]
        if kind == "high" and v == window.max() and (window == v).sum() == 1:
            out.append(i)
        elif kind == "low" and v == window.min() and (window == v).sum() == 1:
            out.append(i)
    return out


def _sma(close: np.ndarray, window: int) -> np.ndarray:
    return pd.Series(close).rolling(window).mean().to_numpy()


def _rsi(close: np.ndarray, window: int = 14) -> float:
    delta = pd.Series(close).diff()
    gain = delta.clip(lower=0).rolling(window).mean()
    loss = (-delta.clip(upper=0)).rolling(window).mean()
    rs = gain / loss.replace(0, np.nan)
    rsi = 100 - 100 / (1 + rs)
    last = rsi.iloc[-1]
    return float(last) if pd.notna(last) else 50.0


def _trend(close: np.ndarray, index: pd.DatetimeIndex) -> Pattern | None:
    lookback = min(60, len(close))
    if lookback < 15:
        return None
    seg = close[-lookback:]
    x = np.arange(lookback)
    slope, intercept = np.polyfit(x, seg, 1)
    fitted = slope * x + intercept
    change = (fitted[-1] - fitted[0]) / fitted[0] * 100 if fitted[0] else 0.0
    ss_res = float(((seg - fitted) ** 2).sum())
    ss_tot = float(((seg - seg.mean()) ** 2).sum())
    r2 = 1 - ss_res / ss_tot if ss_tot else 0.0
    at = _epoch(index, len(close) - 1)

    if change > 5 and r2 > 0.3:
        return {
            "key": "uptrend", "label": "Tren Naik", "kind": "bullish", "at": at,
            "summary": f"Harga sedang dalam tren naik (±{change:.0f}% selama periode terlihat).",
            "detail": "Garis arah harga menanjak cukup rapi. Selama tren naik bertahan, dorongan beli masih dominan — strategi ikut tren cenderung cocok.",
        }
    if change < -5 and r2 > 0.3:
        return {
            "key": "downtrend", "label": "Tren Turun", "kind": "bearish", "at": at,
            "summary": f"Harga sedang dalam tren turun (±{change:.0f}% selama periode terlihat).",
            "detail": "Garis arah harga menurun cukup rapi. Selama tren turun bertahan, tekanan jual masih dominan — hati-hati membeli saat 'pisau jatuh'.",
        }
    return {
        "key": "sideways", "label": "Mendatar (Sideways)", "kind": "neutral", "at": at,
        "summary": "Harga bergerak mendatar tanpa arah jelas.",
        "detail": "Tidak ada tren kuat ke atas atau ke bawah. Strategi ikut tren sering meleset di kondisi begini; pola 'beli murah jual mahal' di dalam rentang lebih masuk akal.",
    }


def _ma_cross(close: np.ndarray, index: pd.DatetimeIndex) -> Pattern | None:
    n = len(close)
    if n >= 200:
        fw, sw, name = 50, 200, "MA50 vs MA200"
    elif n >= 60:
        fw, sw, name = 20, 50, "MA20 vs MA50"
    else:
        return None
    fast, slow = _sma(close, fw), _sma(close, sw)
    if np.isnan(fast[-1]) or np.isnan(slow[-1]):
        return None
    # Did a cross happen within the last ~5 bars?
    recent = "baru saja " if any(
        not np.isnan(fast[-k]) and not np.isnan(slow[-k]) and not np.isnan(fast[-k - 1]) and not np.isnan(slow[-k - 1])
        and (fast[-k] - slow[-k]) * (fast[-k - 1] - slow[-k - 1]) < 0
        for k in range(1, 6) if n > k + 1
    ) else ""
    at = _epoch(index, n - 1)
    if fast[-1] > slow[-1]:
        return {
            "key": "golden_cross", "label": "Golden Cross", "kind": "bullish", "at": at,
            "summary": f"Rata-rata cepat {recent}berada di atas rata-rata lambat ({name}).",
            "detail": "Golden Cross: garis rata-rata jangka pendek menembus ke atas garis jangka panjang — sering dibaca sebagai sinyal awal momentum naik. Cek juga indikator lain, tidak selalu akurat.",
        }
    return {
        "key": "death_cross", "label": "Death Cross", "kind": "bearish", "at": at,
        "summary": f"Rata-rata cepat {recent}berada di bawah rata-rata lambat ({name}).",
        "detail": "Death Cross: garis rata-rata jangka pendek menembus ke bawah garis jangka panjang — sering dibaca sebagai sinyal awal momentum turun. Cek juga indikator lain, tidak selalu akurat.",
    }


def _double(high: np.ndarray, low: np.ndarray, index: pd.DatetimeIndex) -> list[Pattern]:
    out: list[Pattern] = []
    peaks = _pivots(high, "high")
    troughs = _pivots(low, "low")
    if len(peaks) >= 2:
        i1, i2 = peaks[-2], peaks[-1]
        v1, v2 = high[i1], high[i2]
        between = low[i1 : i2 + 1]
        if abs(v1 - v2) / max(v1, v2) < 0.03 and len(between):
            valley = float(between.min())
            if (min(v1, v2) - valley) / min(v1, v2) > 0.02:
                out.append({
                    "key": "double_top", "label": "Double Top (Puncak Ganda)", "kind": "bearish", "at": _epoch(index, i2),
                    "summary": "Harga gagal menembus dua puncak yang setinggi — pola pembalikan ke bawah.",
                    "detail": "Double Top: dua puncak hampir sama tinggi seperti huruf 'M'. Kalau harga jatuh di bawah lembah di antaranya, sering jadi tanda tren naik habis.",
                })
    if len(troughs) >= 2:
        i1, i2 = troughs[-2], troughs[-1]
        v1, v2 = low[i1], low[i2]
        between = high[i1 : i2 + 1]
        if abs(v1 - v2) / max(v1, v2) < 0.03 and len(between):
            peak = float(between.max())
            if (peak - max(v1, v2)) / max(v1, v2) > 0.02:
                out.append({
                    "key": "double_bottom", "label": "Double Bottom (Lembah Ganda)", "kind": "bullish", "at": _epoch(index, i2),
                    "summary": "Harga dua kali memantul dari dasar yang sama — pola pembalikan ke atas.",
                    "detail": "Double Bottom: dua lembah hampir sama dalam seperti huruf 'W'. Kalau harga naik di atas puncak di antaranya, sering jadi tanda tren turun habis.",
                })
    return out


def _head_shoulders(high: np.ndarray, low: np.ndarray, index: pd.DatetimeIndex) -> list[Pattern]:
    out: list[Pattern] = []
    peaks = _pivots(high, "high")
    troughs = _pivots(low, "low")
    if len(peaks) >= 3:
        a, b, c = peaks[-3:]
        ls, head, rs = high[a], high[b], high[c]
        if head > ls and head > rs and abs(ls - rs) / max(ls, rs) < 0.05:
            out.append({
                "key": "head_shoulders", "label": "Head & Shoulders", "kind": "bearish", "at": _epoch(index, c),
                "summary": "Tiga puncak: tengah tertinggi, kiri-kanan sejajar — pola pembalikan ke bawah.",
                "detail": "Head & Shoulders: bahu kiri, kepala (lebih tinggi), bahu kanan. Salah satu pola pembalikan tren naik→turun paling terkenal.",
            })
    if len(troughs) >= 3:
        a, b, c = troughs[-3:]
        ls, head, rs = low[a], low[b], low[c]
        if head < ls and head < rs and abs(ls - rs) / max(ls, rs) < 0.05:
            out.append({
                "key": "inv_head_shoulders", "label": "Inverse Head & Shoulders", "kind": "bullish", "at": _epoch(index, c),
                "summary": "Tiga lembah: tengah terdalam, kiri-kanan sejajar — pola pembalikan ke atas.",
                "detail": "Inverse Head & Shoulders: kebalikan dari H&S. Salah satu pola pembalikan tren turun→naik paling terkenal.",
            })
    return out


def _breakout(high: np.ndarray, low: np.ndarray, close: np.ndarray, index: pd.DatetimeIndex) -> Pattern | None:
    window = min(20, len(close) - 1)
    if window < 5:
        return None
    prior_high = float(high[-(window + 1) : -1].max())
    prior_low = float(low[-(window + 1) : -1].min())
    at = _epoch(index, len(close) - 1)
    if close[-1] > prior_high:
        return {
            "key": "breakout", "label": "Breakout (Tembus Atas)", "kind": "bullish", "at": at,
            "summary": f"Harga menembus level tertinggi {window} batang terakhir.",
            "detail": "Breakout: harga keluar ke atas dari rentang/resistensi terakhir. Sering jadi awal pergerakan naik baru — tapi waspada 'breakout palsu'.",
        }
    if close[-1] < prior_low:
        return {
            "key": "breakdown", "label": "Breakdown (Jebol Bawah)", "kind": "bearish", "at": at,
            "summary": f"Harga jebol di bawah level terendah {window} batang terakhir.",
            "detail": "Breakdown: harga keluar ke bawah dari rentang/support terakhir. Sering jadi awal pergerakan turun baru.",
        }
    return None


def _rsi_extreme(close: np.ndarray, index: pd.DatetimeIndex) -> Pattern | None:
    if len(close) < 15:
        return None
    rsi = _rsi(close)
    at = _epoch(index, len(close) - 1)
    if rsi >= 70:
        return {
            "key": "overbought", "label": "Sudah Kemahalan", "kind": "bearish", "at": at,
            "summary": f"Meteran RSI {rsi:.0f} (di atas 70) — harga sudah naik banyak.",
            "detail": "Meteran RSI di atas 70: harga mungkin sudah 'kemahalan' jangka pendek dan rawan koreksi turun. Cek juga indikator lain, tidak selalu akurat.",
        }
    if rsi <= 30:
        return {
            "key": "oversold", "label": "Sudah Kemurahan", "kind": "bullish", "at": at,
            "summary": f"Meteran RSI {rsi:.0f} (di bawah 30) — harga sudah turun banyak.",
            "detail": "Meteran RSI di bawah 30: harga mungkin sudah 'kemurahan' jangka pendek dan rawan memantul naik. Cek juga indikator lain, tidak selalu akurat.",
        }
    return None


def detect(df: pd.DataFrame) -> tuple[str, str, list[Pattern]]:
    """Return (bias, bias_text, patterns) for an OHLCV frame.

    `bias` summarizes the net of bullish vs bearish patterns.
    """
    close = df["Close"].to_numpy(dtype=float)
    high = df["High"].to_numpy(dtype=float)
    low = df["Low"].to_numpy(dtype=float)
    index = df.index

    patterns: list[Pattern] = []
    for p in (_trend(close, index), _ma_cross(close, index), _breakout(high, low, close, index), _rsi_extreme(close, index)):
        if p:
            patterns.append(p)
    patterns += _double(high, low, index)
    patterns += _head_shoulders(high, low, index)

    score = sum(1 for p in patterns if p["kind"] == "bullish") - sum(1 for p in patterns if p["kind"] == "bearish")
    if score > 0:
        bias, bias_text = "bullish", "Mayoritas pola condong NAIK. Suasana cenderung mendukung beli — tetap kelola risiko."
    elif score < 0:
        bias, bias_text = "bearish", "Mayoritas pola condong TURUN. Suasana cenderung waspada — hati-hati membeli."
    else:
        bias, bias_text = "neutral", "Pola saling imbang / belum jelas. Tidak ada dorongan kuat ke satu arah."
    return bias, bias_text, patterns


def demo() -> None:
    """Self-check: synthetic series must yield the obvious bias."""
    import numpy as np

    def frame(close):
        idx = pd.date_range("2024-01-01", periods=len(close), freq="D")
        c = np.array(close, dtype=float)
        return pd.DataFrame({"Open": c, "High": c * 1.01, "Low": c * 0.99, "Close": c}, index=idx)

    up = frame(list(np.linspace(100, 200, 220)))
    bias, _, pats = detect(up)
    assert bias == "bullish", (bias, [p["key"] for p in pats])
    assert any(p["key"] in ("uptrend", "golden_cross", "breakout") for p in pats)

    down = frame(list(np.linspace(200, 100, 220)))
    bias, _, pats = detect(down)
    assert bias == "bearish", (bias, [p["key"] for p in pats])

    print("patterns.demo OK:", [p["key"] for p in pats])


if __name__ == "__main__":
    demo()
