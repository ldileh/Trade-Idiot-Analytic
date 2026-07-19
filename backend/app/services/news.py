"""Recent headlines for a ticker via yfinance, with a crude keyword sentiment.

yfinance exposes Yahoo Finance's news list per ticker. Its shape has changed
across versions (flat dict vs nested `content`), so we normalise both. Sentiment
is a lexicon count — not NLP — enough to nudge a beginner's portfolio hint
("berita cenderung positif/negatif"), never a signal on its own. Best-effort:
any failure returns an empty list rather than erroring the whole panel.
"""
from __future__ import annotations

import time
from threading import Lock

import yfinance as yf

# (ticker) -> (fetched_at_epoch, items). News moves slowly; a few minutes of
# cache spares Yahoo repeated hits when several holdings refresh together.
_CACHE: dict[str, tuple[float, list[dict]]] = {}
_TTL_SECONDS = 300.0
_LOCK = Lock()

# Lowercase substrings. Deliberately small & finance-flavoured; extend as needed.
# ponytail: lexicon sentiment, not a model — swap for a classifier if it misreads.
_POS = (
    "beat", "beats", "surge", "surges", "soar", "rally", "record", "upgrade",
    "raises", "raise", "growth", "profit", "gains", "gain", "jump", "jumps",
    "strong", "outperform", "buy rating", "bullish", "wins", "win", "boost",
    "approval", "dividend", "buyback", "expansion", "top", "tops", "beat estimates",
)
_NEG = (
    "miss", "misses", "plunge", "plunges", "drop", "drops", "fall", "falls",
    "slump", "downgrade", "cut", "cuts", "loss", "losses", "warn", "warning",
    "weak", "underperform", "sell rating", "bearish", "lawsuit", "probe",
    "investigation", "recall", "layoff", "layoffs", "bankruptcy", "fraud", "halt",
    "decline", "slashes", "slash", "sinks", "sink", "tumble", "tumbles",
)


def _score_text(text: str) -> int:
    t = text.lower()
    pos = sum(1 for w in _POS if w in t)
    neg = sum(1 for w in _NEG if w in t)
    return (pos > neg) - (neg > pos)  # -1, 0, or +1 per headline


def _normalise(raw: dict) -> dict | None:
    """Map one yfinance news entry (either shape) to our flat item, or None."""
    c = raw.get("content") if isinstance(raw.get("content"), dict) else None
    if c:  # newer yfinance: nested under "content"
        title = c.get("title") or ""
        summary = c.get("summary") or c.get("description") or ""
        publisher = (c.get("provider") or {}).get("displayName") or ""
        url = (c.get("canonicalUrl") or c.get("clickThroughUrl") or {}).get("url") or ""
        pub = c.get("pubDate") or ""  # ISO string
        ts = 0
        if pub:
            try:
                ts = int(time.mktime(time.strptime(pub[:19], "%Y-%m-%dT%H:%M:%S")))
            except (ValueError, TypeError):
                ts = 0
    else:  # older yfinance: flat keys
        title = raw.get("title") or ""
        summary = raw.get("summary") or ""
        publisher = raw.get("publisher") or ""
        url = raw.get("link") or ""
        ts = int(raw.get("providerPublishTime") or 0)

    if not title:
        return None
    return {
        "title": title,
        "publisher": publisher,
        "url": url,
        "time": ts,
        "sentiment": _score_text(f"{title} {summary}"),
    }


def get_news(ticker: str, limit: int = 6) -> dict:
    """Recent headlines + net sentiment for `ticker`.

    Returns {"items": [...], "sentiment": int} where sentiment is the summed
    per-headline lexicon score (positive = net-good news flow). Empty on any
    failure — the caller treats "no news" as neutral.
    """
    key = ticker.strip().upper()
    now = time.time()
    with _LOCK:
        hit = _CACHE.get(key)
        if hit and now - hit[0] < _TTL_SECONDS:
            items = hit[1]
        else:
            items = []
            try:
                raw = yf.Ticker(key).news or []
            except Exception:  # noqa: BLE001 — news is best-effort, never fatal
                raw = []
            for entry in raw:
                item = _normalise(entry) if isinstance(entry, dict) else None
                if item:
                    items.append(item)
            items.sort(key=lambda i: i["time"], reverse=True)
            _CACHE[key] = (now, items)

    items = items[:limit]
    return {"items": items, "sentiment": sum(i["sentiment"] for i in items)}


if __name__ == "__main__":  # quick self-check of the sentiment lexicon
    assert _score_text("Company beats estimates, shares surge") == 1
    assert _score_text("Stock plunges on profit warning and downgrade") == -1
    assert _score_text("Company announces annual meeting date") == 0
    print("news sentiment self-check ok")
