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

# Fundamentals barely move intraday; cache longer than price data.
_CACHE: dict[str, tuple[float, dict]] = {}
_CACHE_TTL_SECONDS = 3600.0
_LOCK = Lock()

# verdict: +1 good, 0 neutral, -1 bad. None value -> "no data", scored neutral.
Verdict = int


class FundamentalsError(Exception):
    """Raised when no usable fundamental data exists for a ticker."""


def _info(ticker: str) -> dict:
    cached = _CACHE.get(ticker)
    now = time.time()
    if cached and (now - cached[0]) < _CACHE_TTL_SECONDS:
        return cached[1]
    info = yf.Ticker(ticker).info or {}
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


def get_fundamentals(ticker: str) -> dict:
    """Build the fundamentals payload: per-metric verdicts + a composite score.

    Score = share of judged (non-neutral, has-data) metrics that are positive,
    on a 0–100 scale. Raises FundamentalsError if .info has none of our fields
    (e.g. an index or a delisted ticker).
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

    score = round(100 * good / judged) if judged else 50
    if score >= 70:
        bias, bias_text = "good", "Fundamental tergolong sehat: sebagian besar rasio positif."
    elif score <= 40:
        bias, bias_text = "bad", "Fundamental lemah: banyak rasio yang perlu diwaspadai."
    else:
        bias, bias_text = "neutral", "Fundamental campuran: ada yang bagus, ada yang perlu dicermati."

    return {
        "ticker": ticker,
        "name": info.get("shortName") or info.get("longName") or ticker,
        "score": score,
        "bias": bias,
        "bias_text": bias_text,
        "metrics": metrics,
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
    print("fundamentals.py self-check OK")
