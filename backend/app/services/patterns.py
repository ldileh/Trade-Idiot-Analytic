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


def _ema(close: np.ndarray, span: int) -> np.ndarray:
    return pd.Series(close).ewm(span=span, adjust=False).mean().to_numpy()


# --- EMA trend context (Arévalo et al. 2017) --------------------------------
# A pattern read in isolation is weak: the same Double Bottom means one thing in
# an uptrend and another against a downtrend. Arévalo et al. filter flag
# patterns against short/medium EMAs before acting on them and report higher
# profit at lower risk than the unfiltered rule. We don't trade, so we don't
# drop patterns — we label each one with its trend context so a beginner sees
# which signals have the prevailing trend behind them and which fight it.
_EMA_FAST, _EMA_SLOW = 20, 50
_MIN_BARS_FOR_TREND = _EMA_SLOW + 5  # let the slow EMA settle before trusting it


def _ema_trend(close: np.ndarray) -> str:
    """Prevailing trend as "bullish" | "bearish" | "neutral" from EMA20 vs EMA50.

    Neutral when there is too little history, or the two EMAs sit within 0.5% of
    each other — that gap is noise, not a trend, and calling it either way would
    put a confident label on a coin flip.
    """
    if len(close) < _MIN_BARS_FOR_TREND:
        return "neutral"
    fast = _ema(close, _EMA_FAST)[-1]
    slow = _ema(close, _EMA_SLOW)[-1]
    if np.isnan(fast) or np.isnan(slow) or not slow:
        return "neutral"
    gap = (fast - slow) / abs(slow)
    if gap > 0.005:
        return "bullish"
    if gap < -0.005:
        return "bearish"
    return "neutral"


# Trend-context copy, keyed by (pattern kind, prevailing trend).
_ALIGNED = (
    "Searah tren — pola ini sejalan dengan arah harga saat ini (EMA20 vs EMA50), "
    "jadi lebih layak diperhatikan."
)
_AGAINST = (
    "Melawan tren — pola ini berlawanan dengan arah harga saat ini (EMA20 vs EMA50). "
    "Pola pembalikan sering gagal saat melawan tren; tunggu konfirmasi."
)
_NO_TREND = (
    "Tren belum jelas — harga mendatar (EMA20 ≈ EMA50), jadi pola ini belum punya "
    "dukungan arah. Sinyal di kondisi mendatar lebih sering meleset."
)


def _annotate_trend(patterns: list[Pattern], trend: str) -> None:
    """Tag each pattern with its EMA trend context, in place.

    Adds `align` ("aligned" | "against" | "unclear") plus a plain-Indonesian
    `align_text`. Directionless patterns (the trend/sideways reading itself)
    are left unannotated — labelling the trend against itself is circular.
    """
    for p in patterns:
        # The trend reading IS the trend; don't grade it against itself.
        if p["key"] in ("uptrend", "downtrend", "sideways") or p["kind"] == "neutral":
            p["align"] = None
            p["align_text"] = ""
            continue
        if trend == "neutral":
            p["align"], p["align_text"] = "unclear", _NO_TREND
        elif p["kind"] == trend:
            p["align"], p["align_text"] = "aligned", _ALIGNED
        else:
            p["align"], p["align_text"] = "against", _AGAINST


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

    trend = _ema_trend(close)
    _annotate_trend(patterns, trend)

    # Weight by trend context rather than counting every pattern equally: a
    # signal fighting the prevailing trend is the one most likely to fail
    # (Arévalo et al. 2017), so it counts for less than one riding it.
    _WEIGHT = {"aligned": 1.5, "against": 0.5, "unclear": 1.0, None: 1.0}
    score = sum(
        _WEIGHT[p.get("align")] * (1 if p["kind"] == "bullish" else -1)
        for p in patterns
        if p["kind"] in ("bullish", "bearish")
    )
    trend_note = {
        "bullish": " Arah harga saat ini NAIK (EMA20 di atas EMA50).",
        "bearish": " Arah harga saat ini TURUN (EMA20 di bawah EMA50).",
        "neutral": " Arah harga belum jelas (EMA20 ≈ EMA50).",
    }[trend]
    if score > 0:
        bias, bias_text = "bullish", "Mayoritas pola condong NAIK. Suasana cenderung mendukung beli — tetap kelola risiko."
    elif score < 0:
        bias, bias_text = "bearish", "Mayoritas pola condong TURUN. Suasana cenderung waspada — hati-hati membeli."
    else:
        bias, bias_text = "neutral", "Pola saling imbang / belum jelas. Tidak ada dorongan kuat ke satu arah."
    return bias, bias_text + trend_note, patterns


def demo() -> None:
    """Self-check: synthetic series must yield the obvious bias."""
    import numpy as np

    def frame(close):
        idx = pd.date_range("2024-01-01", periods=len(close), freq="D")
        c = np.array(close, dtype=float)
        return pd.DataFrame({"Open": c, "High": c * 1.01, "Low": c * 0.99, "Close": c}, index=idx)

    up = frame(list(np.linspace(100, 200, 220)))
    bias, text, pats = detect(up)
    assert bias == "bullish", (bias, [p["key"] for p in pats])
    assert any(p["key"] in ("uptrend", "golden_cross", "breakout") for p in pats)

    # EMA trend context: in a clean uptrend the bullish patterns ride the trend.
    assert _ema_trend(up["Close"].to_numpy(dtype=float)) == "bullish"
    assert "NAIK" in text, text
    _TREND_KEYS = ("uptrend", "downtrend", "sideways")
    for p in pats:
        if p["kind"] == "bullish" and p["key"] not in _TREND_KEYS:
            assert p["align"] == "aligned", (p["key"], p["align"])
            assert p["align_text"], p["key"]
    # The trend reading itself is never graded against itself (circular).
    for p in pats:
        if p["key"] in _TREND_KEYS:
            assert p["align"] is None, (p["key"], p["align"])

    down = frame(list(np.linspace(200, 100, 220)))
    bias, text, pats = detect(down)
    assert bias == "bearish", (bias, [p["key"] for p in pats])
    assert _ema_trend(down["Close"].to_numpy(dtype=float)) == "bearish"
    assert "TURUN" in text, text

    # Flat prices -> no trend, so patterns are "unclear" rather than mislabelled.
    flat = frame([100.0] * 220)
    assert _ema_trend(flat["Close"].to_numpy(dtype=float)) == "neutral"
    # Too little history must not fake a trend either.
    assert _ema_trend(np.linspace(100, 200, 10)) == "neutral"

    # A bearish pattern inside an uptrend is weighted down, not counted equally.
    fighting = [{"key": "double_top", "kind": "bearish"}, {"key": "breakout", "kind": "bullish"}]
    _annotate_trend(fighting, "bullish")
    assert fighting[0]["align"] == "against", fighting[0]
    assert fighting[1]["align"] == "aligned", fighting[1]

    print("patterns.demo OK:", [(p["key"], p.get("align")) for p in pats])


if __name__ == "__main__":
    demo()
