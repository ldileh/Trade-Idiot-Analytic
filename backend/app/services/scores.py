"""Piotroski F-Score & Altman Z-Score from yfinance financial statements.

Two research-backed fundamental scores, kept deliberately separate (a beginner
reads "Skor Kesehatan Keuangan 7/9" and "Skor Risiko Bangkrut: aman" far more
easily than one blended number):

  - Piotroski F-Score (0–9): nine binary accounting signals — profitability,
    leverage/liquidity, operating efficiency — comparing this year to last.
  - Altman Z-Score: five balance-sheet/earnings ratios → a distress zone
    (aman / abu-abu / bahaya).

Both need `.financials`, `.balance_sheet`, `.cashflow` (annual) plus market cap.
yfinance row labels vary and IDX statements are often sparse, so every field
lookup tries a few candidate labels and returns None on a miss; when too much is
missing the score is reported as "tidak cukup data" rather than a misleading
number or a 500.
"""
from __future__ import annotations

import time
from threading import Lock

import pandas as pd
import yfinance as yf

_CACHE: dict[str, tuple[float, dict]] = {}
_CACHE_TTL_SECONDS = 3600.0  # statements change quarterly at most
_LOCK = Lock()


def _col(df: pd.DataFrame, labels: list[str], year: int) -> float | None:
    """Value from `df` for the first matching row label, `year` columns back
    (0 = latest). None if the frame/column/row is missing or non-numeric."""
    if df is None or df.empty or df.shape[1] <= year:
        return None
    for label in labels:
        if label in df.index:
            v = df.iloc[:, year][label] if label in df.index else None
            try:
                f = float(v)
            except (TypeError, ValueError):
                continue
            if pd.notna(f):
                return f
    return None


def _piotroski(fin: pd.DataFrame, bal: pd.DataFrame, cf: pd.DataFrame) -> dict:
    """Nine binary signals, this year (col 0) vs last (col 1). Each present
    signal contributes 0/1; missing inputs drop that signal from the total."""
    def g(df, labels, year):
        return _col(df, labels, year)

    ni = g(fin, ["Net Income", "Net Income Common Stockholders"], 0)
    ni_prev = g(fin, ["Net Income", "Net Income Common Stockholders"], 1)
    assets = g(bal, ["Total Assets"], 0)
    assets_prev = g(bal, ["Total Assets"], 1)
    cfo = g(cf, ["Operating Cash Flow", "Cash Flow From Continuing Operating Activities"], 0)
    ltd = g(bal, ["Long Term Debt"], 0)
    ltd_prev = g(bal, ["Long Term Debt"], 1)
    cur_assets = g(bal, ["Current Assets"], 0)
    cur_liab = g(bal, ["Current Liabilities"], 0)
    cur_assets_prev = g(bal, ["Current Assets"], 1)
    cur_liab_prev = g(bal, ["Current Liabilities"], 1)
    shares = g(bal, ["Share Issued", "Ordinary Shares Number"], 0)
    shares_prev = g(bal, ["Share Issued", "Ordinary Shares Number"], 1)
    rev = g(fin, ["Total Revenue", "Operating Revenue"], 0)
    rev_prev = g(fin, ["Total Revenue", "Operating Revenue"], 1)
    gp = g(fin, ["Gross Profit"], 0)
    gp_prev = g(fin, ["Gross Profit"], 1)

    roa = (ni / assets) if (ni is not None and assets) else None
    roa_prev = (ni_prev / assets_prev) if (ni_prev is not None and assets_prev) else None
    cur = (cur_assets / cur_liab) if (cur_assets is not None and cur_liab) else None
    cur_prev = (cur_assets_prev / cur_liab_prev) if (cur_assets_prev is not None and cur_liab_prev) else None
    gm = (gp / rev) if (gp is not None and rev) else None
    gm_prev = (gp_prev / rev_prev) if (gp_prev is not None and rev_prev) else None
    turn = (rev / assets) if (rev is not None and assets) else None
    turn_prev = (rev_prev / assets_prev) if (rev_prev is not None and assets_prev) else None

    # (label, passes?) — None = input missing, signal skipped.
    signals: list[tuple[str, bool | None]] = [
        ("Laba bersih positif", (ni > 0) if ni is not None else None),
        ("Arus kas operasi positif", (cfo > 0) if cfo is not None else None),
        ("ROA membaik", (roa > roa_prev) if (roa is not None and roa_prev is not None) else None),
        ("Arus kas > laba (kualitas laba)",
         (cfo > ni) if (cfo is not None and ni is not None) else None),
        ("Utang jangka panjang turun",
         (ltd <= ltd_prev) if (ltd is not None and ltd_prev is not None) else None),
        ("Rasio lancar membaik",
         (cur > cur_prev) if (cur is not None and cur_prev is not None) else None),
        ("Tidak menambah saham baru",
         (shares <= shares_prev) if (shares is not None and shares_prev is not None) else None),
        ("Margin kotor membaik", (gm > gm_prev) if (gm is not None and gm_prev is not None) else None),
        ("Perputaran aset membaik",
         (turn > turn_prev) if (turn is not None and turn_prev is not None) else None),
    ]

    judged = [s for s in signals if s[1] is not None]
    passed = sum(1 for _, ok in judged if ok)
    return {
        "score": passed,
        "max": 9,
        "judged": len(judged),
        "signals": [
            {"label": lbl, "pass": bool(ok)} for lbl, ok in signals if ok is not None
        ],
    }


def _altman(fin: pd.DataFrame, bal: pd.DataFrame, market_cap: float | None) -> dict:
    """Altman Z = 1.2·A + 1.4·B + 3.3·C + 0.6·D + 1.0·E (classic manufacturing
    form). Returns the score + zone, or None inputs if too sparse."""
    assets = _col(bal, ["Total Assets"], 0)
    wc = _col(bal, ["Working Capital"], 0)
    if wc is None:
        ca = _col(bal, ["Current Assets"], 0)
        cl = _col(bal, ["Current Liabilities"], 0)
        wc = (ca - cl) if (ca is not None and cl is not None) else None
    retained = _col(bal, ["Retained Earnings"], 0)
    ebit = _col(fin, ["EBIT", "Operating Income"], 0)
    liabilities = _col(bal, ["Total Liabilities Net Minority Interest"], 0)
    sales = _col(fin, ["Total Revenue", "Operating Revenue"], 0)

    if not assets or liabilities is None or not liabilities:
        return {"score": None, "zone": None, "zone_text": "tidak cukup data"}

    def ratio(x):
        return (x / assets) if x is not None else None

    a, b, c = ratio(wc), ratio(retained), ratio(ebit)
    d = (market_cap / liabilities) if market_cap else None
    e = ratio(sales)
    parts = [a, b, c, d, e]
    if sum(p is None for p in parts) > 1:  # need at least 4 of 5 ratios
        return {"score": None, "zone": None, "zone_text": "tidak cukup data"}
    a, b, c, d, e = (p if p is not None else 0.0 for p in parts)

    z = 1.2 * a + 1.4 * b + 3.3 * c + 0.6 * d + 1.0 * e
    if z >= 2.99:
        zone, text = "safe", "Risiko bangkrut rendah (zona aman)."
    elif z >= 1.81:
        zone, text = "grey", "Waspada — zona abu-abu, perhatikan tren laba & utang."
    else:
        zone, text = "distress", "Risiko kesulitan keuangan tinggi (zona bahaya)."
    return {"score": round(z, 2), "zone": zone, "zone_text": text}


def _statements(ticker: str) -> dict:
    cached = _CACHE.get(ticker)
    now = time.time()
    if cached and (now - cached[0]) < _CACHE_TTL_SECONDS:
        return cached[1]
    t = yf.Ticker(ticker)
    data = {
        "financials": t.financials,
        "balance_sheet": t.balance_sheet,
        "cashflow": t.cashflow,
        "market_cap": (t.info or {}).get("marketCap"),
    }
    with _LOCK:
        _CACHE[ticker] = (now, data)
    return data


# Beginner tips (BI) per score — labels follow PLAN.md §3.
F_TIP = ("Menilai apakah perusahaan untung, hutangnya wajar, dan operasinya makin "
         "efisien. Dari 9 sinyal akuntansi; makin tinggi makin sehat (7–9 kuat, "
         "0–3 lemah).")
Z_TIP = ("Menilai kemungkinan perusahaan kesulitan keuangan 1–2 tahun ke depan. "
         "Zona aman (≥2,99), abu-abu (1,81–2,99), bahaya (<1,81).")


def get_scores(ticker: str) -> dict:
    """F-Score & Z-Score payload for a ticker. Never raises on sparse data —
    a score with no usable inputs is reported as 'tidak cukup data'."""
    ticker = ticker.strip().upper()
    s = _statements(ticker)
    fin, bal, cf = s["financials"], s["balance_sheet"], s["cashflow"]

    piotroski = _piotroski(fin, bal, cf)
    altman = _altman(fin, bal, s.get("market_cap"))

    f_enough = piotroski["judged"] >= 5  # need most signals to trust the 0–9
    return {
        "piotroski": {
            "label": "Skor Kesehatan Keuangan",
            "tip": F_TIP,
            "score": piotroski["score"] if f_enough else None,
            "max": 9,
            "enough_data": f_enough,
            "signals": piotroski["signals"],
        },
        "altman": {
            "label": "Skor Risiko Bangkrut",
            "tip": Z_TIP,
            "score": altman["score"],
            "zone": altman["zone"],
            "zone_text": altman["zone_text"],
            "enough_data": altman["score"] is not None,
        },
    }


def demo() -> None:
    """Live self-check against a large, well-covered US ticker."""
    out = get_scores("AAPL")
    p, a = out["piotroski"], out["altman"]
    assert p["enough_data"] and 0 <= p["score"] <= 9, p
    assert a["enough_data"] and a["zone"] in ("safe", "grey", "distress"), a
    print(f"scores.demo OK: F={p['score']}/9 Z={a['score']} ({a['zone']})")


if __name__ == "__main__":
    demo()
