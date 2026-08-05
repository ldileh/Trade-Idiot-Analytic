"""Fundamental ratios from yfinance `.info`, scored into a plain-language verdict.

yfinance exposes a company's valuation/health/growth numbers in Ticker.info.
We pick the useful ones, judge each as good/neutral/bad against rough rules of
thumb, and roll them into one 0–100 "health" score so a beginner gets a single
takeaway plus the reasoning. All ratios fail soft: a missing field (common for
banks, e.g. currentRatio) is shown as "tidak ada data", not an error.
"""
from __future__ import annotations

import time
from threading import Lock
from typing import Callable

import yfinance as yf

from app.services.scores import get_scores

# Fundamentals barely move intraday; cache longer than price data.
_CACHE: dict[str, tuple[float, dict]] = {}
_CACHE_TTL_SECONDS = 3600.0
# Yahoo sometimes answers an equity with a partial .info (rate limiting, or a
# half-filled quoteSummary). Caching that for the full hour freezes a broken
# panel — every ratio reads "tidak ada data" until the TTL lapses. Keep such
# responses only briefly so the next view retries instead of being stuck.
_PARTIAL_TTL_SECONDS = 60.0
_LOCK = Lock()

# A healthy equity payload carries most of these. The DEWA.JK case that prompted
# this kept marketCap/PE/PBV but lost every profitability ratio, so requiring
# merely one is not enough — we check coverage instead. Non-equities (index/ETF)
# have no ratios by nature and are cached normally, not retried every minute.
_CORE_KEYS = (
    "trailingPE", "priceToBook", "returnOnEquity", "returnOnAssets",
    "profitMargins", "trailingEps", "marketCap",
)
_MIN_CORE_PRESENT = 4


def _is_partial(info: dict) -> bool:
    """True when an equity came back missing most of its core ratios."""
    if not info:
        return True
    if info.get("quoteType") != "EQUITY":
        return False  # index/ETF/crypto: missing ratios are expected, not a fault
    present = sum(
        1 for k in _CORE_KEYS
        if isinstance(info.get(k), (int, float)) and not isinstance(info.get(k), bool)
    )
    return present < _MIN_CORE_PRESENT


# verdict: +1 good, 0 neutral, -1 bad. None value -> "no data", scored neutral.
Verdict = int


class FundamentalsError(Exception):
    """Raised when no usable fundamental data exists for a ticker."""


def _info(ticker: str) -> dict:
    cached = _CACHE.get(ticker)
    now = time.time()
    if cached:
        # A partial payload gets a short lease so a transient Yahoo hiccup can't
        # pin an empty panel in place for the whole hour.
        ttl = _PARTIAL_TTL_SECONDS if _is_partial(cached[1]) else _CACHE_TTL_SECONDS
        if (now - cached[0]) < ttl:
            return cached[1]
    info = yf.Ticker(ticker).info or {}
    # Prefer a good cached payload over a fresh partial one: when the retry comes
    # back degraded, keep serving what we already had rather than regressing the
    # panel to "tidak ada data".
    if cached and _is_partial(info) and not _is_partial(cached[1]):
        return cached[1]
    with _LOCK:
        _CACHE[ticker] = (now, info)
    return info


# Each metric: key in .info, friendly label, group, plain tip, a formatter, and
# a judge(value)->verdict. `pct=True` means the raw value is a fraction we show
# as a percent (×100). yfinance is inconsistent: ROE/margins come as fractions,
# but dividendYield already comes as a percent number, so it's not flagged pct.
def _pct(v: float) -> str:
    return f"{v * 100:.1f}%"


def _ratio(v: float) -> str:
    return f"{v:.2f}×"


def _plain(v: float) -> str:
    return f"{v:.2f}"


def _money(v: float) -> str:
    for unit, div in (("T", 1e12), ("B", 1e9), ("M", 1e6)):
        if abs(v) >= div:
            return f"{v / div:.2f}{unit}"
    return f"{v:.0f}"


# (key, label, group, tip, formatter, judge)
_METRICS: list[tuple[str, str, str, str, Callable[[float], str], Callable[[float], Verdict]]] = [
    # --- Valuasi ---
    ("trailingPE", "PER (Harga ÷ Laba)", "Valuasi",
     "Berapa kali laba setahun yang kamu bayar untuk satu saham. Makin kecil makin murah; di bawah ~15 sering dianggap murah, di atas ~40 mahal.",
     _ratio, lambda v: 1 if 0 < v < 15 else (-1 if v > 40 else 0)),
    ("priceToBook", "PBV (Harga ÷ Nilai Buku)", "Valuasi",
     "Harga saham dibanding nilai aset bersih perusahaan. Di bawah 1× artinya dihargai lebih murah dari asetnya; di atas ~5× tergolong mahal.",
     _ratio, lambda v: 1 if 0 < v < 1 else (-1 if v > 5 else 0)),
    ("priceToSalesTrailing12Months", "PSR (Harga ÷ Penjualan)", "Valuasi",
     "Harga saham dibanding pendapatannya. Berguna untuk perusahaan yang belum untung. Di bawah ~2× relatif murah.",
     _ratio, lambda v: 1 if 0 < v < 2 else (-1 if v > 10 else 0)),
    ("dividendYield", "Imbal Hasil Dividen", "Valuasi",
     "Persentase uang dividen per tahun dibanding harga saham. Makin tinggi makin besar 'bunga' yang kamu terima. 0 berarti tidak bagi dividen.",
     lambda v: f"{v:.2f}%", lambda v: 1 if v >= 3 else 0),
    ("marketCap", "Kapitalisasi Pasar", "Valuasi",
     "Total nilai seluruh saham perusahaan (harga × jumlah saham). Ukuran besar-kecilnya perusahaan, bukan murah/mahal.",
     _money, lambda v: 0),
    # --- Kesehatan & profitabilitas ---
    ("returnOnEquity", "ROE (Imbal Hasil Modal)", "Kesehatan",
     "Seberapa untung perusahaan dari modal pemegang saham. Di atas 15% itu bagus — perusahaan memutar modal jadi laba dengan efisien.",
     _pct, lambda v: 1 if v >= 0.15 else (-1 if v < 0 else 0)),
    ("returnOnAssets", "ROA (Imbal Hasil Aset)", "Kesehatan",
     "Seberapa untung perusahaan dari seluruh asetnya. Di atas 5% tergolong sehat.",
     _pct, lambda v: 1 if v >= 0.05 else (-1 if v < 0 else 0)),
    ("profitMargins", "Margin Laba Bersih", "Kesehatan",
     "Dari tiap Rp100 penjualan, berapa yang jadi laba bersih. Makin tinggi makin efisien; di atas 10% sudah baik.",
     _pct, lambda v: 1 if v >= 0.10 else (-1 if v < 0 else 0)),
    ("debtToEquity", "Utang ÷ Modal", "Kesehatan",
     "Seberapa banyak utang dibanding modal sendiri. Makin kecil makin aman; di atas ~150 (1,5×) tergolong berat utang.",
     _plain, lambda v: 1 if v < 80 else (-1 if v > 150 else 0)),
    ("currentRatio", "Rasio Lancar", "Kesehatan",
     "Kemampuan bayar utang jangka pendek dari aset lancar. Di atas 1,5× artinya lapang; di bawah 1× perlu hati-hati.",
     _ratio, lambda v: 1 if v >= 1.5 else (-1 if v < 1 else 0)),
    # --- Pertumbuhan & EPS ---
    ("trailingEps", "EPS (Laba per Saham)", "Pertumbuhan",
     "Laba bersih dibagi jumlah saham — laba yang 'jatah' tiap satu lembar saham. Positif berarti perusahaan untung.",
     _plain, lambda v: 1 if v > 0 else -1),
    ("revenueGrowth", "Pertumbuhan Pendapatan", "Pertumbuhan",
     "Seberapa cepat penjualan tumbuh dibanding tahun lalu. Positif & makin besar makin baik.",
     _pct, lambda v: 1 if v >= 0.10 else (-1 if v < 0 else 0)),
    ("earningsGrowth", "Pertumbuhan Laba", "Pertumbuhan",
     "Seberapa cepat laba tumbuh dibanding tahun lalu. Positif & makin besar makin baik.",
     _pct, lambda v: 1 if v >= 0.10 else (-1 if v < 0 else 0)),
    ("trailingPegRatio", "PEG (PER ÷ Pertumbuhan)", "Pertumbuhan",
     "PER disesuaikan dengan kecepatan tumbuh laba. Di bawah 1× sering dianggap murah relatif terhadap pertumbuhannya.",
     _ratio, lambda v: 1 if 0 < v < 1 else (-1 if v > 2 else 0)),
]

_VERDICT_TEXT = {1: "bagus", 0: "netral", -1: "perlu diwaspadai"}

# Below this many judged metrics the composite is noise, not a verdict: one
# lucky PER would otherwise read "100/100 — fundamental tergolong sehat" while
# every profitability ratio is missing. We withhold the score instead.
_MIN_JUDGED_FOR_SCORE = 4


def get_fundamentals(ticker: str) -> dict:
    """Build the fundamentals payload: per-metric verdicts + a composite score.

    Score = share of judged (non-neutral, has-data) metrics that are positive,
    on a 0–100 scale. Raises FundamentalsError if .info has none of our fields
    (e.g. an index or a delisted ticker). When too few metrics could be judged
    the score is withheld (`score=None`, `bias="unknown"`) rather than reported
    from a sliver of data.
    """
    ticker = ticker.strip().upper()
    info = _info(ticker)

    metrics = []
    good = bad = 0
    for key, label, group, tip, fmt, judge in _METRICS:
        raw = info.get(key)
        has = isinstance(raw, (int, float)) and not isinstance(raw, bool)
        verdict = judge(float(raw)) if has else 0
        if has and verdict == 1:
            good += 1
        elif has and verdict == -1:
            bad += 1
        metrics.append({
            "key": key,
            "label": label,
            "group": group,
            "tip": tip,
            "value": float(raw) if has else None,
            "display": fmt(float(raw)) if has else "tidak ada data",
            "verdict": verdict if has else 0,
            "verdict_text": _VERDICT_TEXT[verdict] if has else "tidak ada data",
        })

    judged = good + bad
    if judged == 0 and all(m["value"] is None for m in metrics):
        raise FundamentalsError(
            f"Tidak ada data fundamental untuk '{ticker}'. "
            "Cek kode sahamnya, atau ini mungkin indeks/ETF tanpa laporan keuangan."
        )

    if judged < _MIN_JUDGED_FOR_SCORE:
        # Too thin to grade. Say so plainly instead of implying a healthy read.
        score = None
        bias = "unknown"
        bias_text = (
            f"Data belum cukup untuk memberi skor ({judged} dari "
            f"{_MIN_JUDGED_FOR_SCORE} rasio minimal bisa dinilai). "
            "Sumber data mungkin sedang tidak lengkap — coba lagi beberapa saat lagi."
        )
    else:
        score = round(100 * good / judged)
        if score >= 70:
            bias, bias_text = "good", "Fundamental tergolong sehat: sebagian besar rasio positif."
        elif score <= 40:
            bias, bias_text = "bad", "Fundamental lemah: banyak rasio yang perlu diwaspadai."
        else:
            bias, bias_text = "neutral", "Fundamental campuran: ada yang bagus, ada yang perlu dicermati."

    # Two separate research-backed scores (Piotroski / Altman) alongside the
    # composite. Fail soft: if the statements aren't reachable, omit them rather
    # than fail the whole fundamentals response.
    try:
        scores = get_scores(ticker)
    except Exception:  # noqa: BLE001 — scores are a best-effort add-on
        scores = {"piotroski": None, "altman": None}

    return {
        "ticker": ticker,
        "name": info.get("shortName") or info.get("longName") or ticker,
        "score": score,
        "bias": bias,
        "bias_text": bias_text,
        "metrics": metrics,
        "piotroski": scores.get("piotroski"),
        "altman": scores.get("altman"),
    }


if __name__ == "__main__":
    # Self-check the scoring math with a stubbed .info (no network).
    _CACHE["TEST"] = (time.time(), {
        "trailingPE": 10,          # good
        "returnOnEquity": 0.20,    # good
        "debtToEquity": 200,       # bad
        "trailingEps": 5,          # good
        # rest missing -> neutral/no-data
    })
    out = get_fundamentals("TEST")
    assert out["score"] == 75, out["score"]  # 3 good / 4 judged
    assert out["bias"] == "good", out["bias"]
    pe = next(x for x in out["metrics"] if x["key"] == "trailingPE")
    assert pe["display"] == "10.00×" and pe["verdict"] == 1
    missing = next(x for x in out["metrics"] if x["key"] == "currentRatio")
    assert missing["value"] is None and missing["display"] == "tidak ada data"

    # Too few judged metrics -> withhold the score instead of reporting 100.
    # This is the DEWA.JK regression: only trailingPE survived, which used to
    # render "100/100 — fundamental tergolong sehat".
    _CACHE["THIN"] = (time.time(), {"trailingPE": 10, "priceToBook": 2.5, "marketCap": 1e12})
    thin = get_fundamentals("THIN")
    assert thin["score"] is None, thin["score"]
    assert thin["bias"] == "unknown", thin["bias"]
    assert "belum cukup" in thin["bias_text"], thin["bias_text"]

    # A partial equity payload must not earn the full one-hour cache lease.
    full = {k: 1.0 for k in _CORE_KEYS} | {"quoteType": "EQUITY"}
    assert not _is_partial(full)
    assert _is_partial({"quoteType": "EQUITY", "trailingPE": 4.3, "marketCap": 1e12})
    assert _is_partial({})
    # Indices/ETFs legitimately have no ratios -> cached normally, not retried.
    assert not _is_partial({"quoteType": "ETF", "shortName": "Some ETF"})
    print("fundamentals.py self-check OK")
