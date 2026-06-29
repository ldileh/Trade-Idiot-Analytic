"""Share-ownership data from KSEI's monthly "Balance Position" archive.

KSEI publishes a month-end pipe-delimited file listing, for every IDX security,
the registered holdings split by Local/Foreign and by investor type:

  Date|Code|Type|Sec. Num|Price|
  Local IS|Local CP|Local PF|Local IB|Local ID|Local MF|Local SC|Local FD|Local OT|Total|
  Foreign IS|Foreign CP|Foreign PF|Foreign IB|Foreign ID|Foreign MF|Foreign SC|Foreign FD|Foreign OT|Total

Downloaded from:
  https://web.ksei.co.id/Download/BalancePosEfek{YYYYMMDD}.zip

We fetch a few month-end snapshots, parse the row for one ticker, and expose:
  - a time series of the Local/Foreign × type breakdown (Balance Position chart)
  - the latest snapshot's composition (% foreign, free float proxy, holders)

Network access is cached on disk so repeated views don't re-download the ~120KB
ZIPs. This is best-effort public data; if KSEI changes the format or a date is
missing, the affected snapshot is skipped.
"""
from __future__ import annotations

import csv
import io
import time
import zipfile
from datetime import date
from threading import Lock

import requests

# Investor-type suffixes used in the KSEI columns, with human labels.
TYPE_LABELS: dict[str, str] = {
    "IS": "Asuransi",
    "CP": "Korporat",
    "PF": "Dana Pensiun",
    "IB": "Bank",
    "ID": "Individual",
    "MF": "Reksadana",
    "SC": "Sekuritas",
    "FD": "Yayasan",
    "OT": "Lainnya",
}
_TYPES = list(TYPE_LABELS)

_KSEI_URL = "https://web.ksei.co.id/Download/BalancePosEfek{ymd}.zip"
_CACHE_TTL = 6 * 3600.0  # ownership data is monthly; cache snapshots for hours
# (ymd) -> (fetched_at, {code -> row dict}) ; a whole file is cached at once.
_CACHE: dict[str, tuple[float, dict[str, dict]]] = {}
_LOCK = Lock()


class OwnershipError(Exception):
    """Raised when no ownership data could be retrieved for a ticker."""


def _month_end_candidates(n: int) -> list[list[str]]:
    """For each of the last `n` months, a list of candidate YYYYMMDD dates
    (the calendar month-end walking back a few days), most recent month first.

    KSEI snapshots fall on the last *business* day, which may be a day or two
    before the calendar end; the caller tries each candidate until one loads.
    """
    today = date.today()
    out: list[list[str]] = []
    y, m = today.year, today.month
    for _ in range(n):
        nxt = date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1)
        last_ord = nxt.toordinal() - 1
        # Try the month-end and up to 4 preceding days (covers weekends/holidays).
        cands = [date.fromordinal(last_ord - k).strftime("%Y%m%d") for k in range(5)]
        out.append(cands)
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    return out


def _fetch_file(ymd: str) -> dict[str, dict] | None:
    """Download+parse one KSEI snapshot into {code -> parsed row}. Cached.

    Returns None if the snapshot can't be fetched (e.g. weekend/holiday date).
    """
    now = time.time()
    with _LOCK:
        cached = _CACHE.get(ymd)
        if cached and (now - cached[0]) < _CACHE_TTL:
            return cached[1]

    url = _KSEI_URL.format(ymd=ymd)
    try:
        resp = requests.get(url, timeout=30)
        if resp.status_code != 200 or not resp.content:
            return None
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        name = zf.namelist()[0]
        text = zf.read(name).decode("utf-8", errors="replace")
    except (requests.RequestException, zipfile.BadZipFile, IndexError):
        return None

    rows: dict[str, dict] = {}
    rdr = csv.reader(io.StringIO(text), delimiter="|")
    header = next(rdr, None)
    if not header:
        return None
    # Two "Total" columns: first is Local total, second is Foreign total.
    first_total = header.index("Total")
    second_total = header.index("Total", first_total + 1)
    idx = {name: i for i, name in enumerate(header)}

    for row in rdr:
        if len(row) <= second_total or row[idx["Type"]] != "EQUITY":
            continue
        code = row[idx["Code"]]
        try:
            local = {t: float(row[idx[f"Local {t}"]]) for t in _TYPES}
            foreign = {t: float(row[idx[f"Foreign {t}"]]) for t in _TYPES}
            rows[code] = {
                "date": row[idx["Date"]],
                "sec_num": float(row[idx["Sec. Num"]]),
                "price": float(row[idx["Price"]]),
                "local": local,
                "foreign": foreign,
                "local_total": float(row[first_total]),
                "foreign_total": float(row[second_total]),
            }
        except (ValueError, KeyError):
            continue

    with _LOCK:
        _CACHE[ymd] = (now, rows)
    return rows


def _snapshot_for(code: str, ymd: str) -> dict | None:
    f = _fetch_file(ymd)
    if not f:
        return None
    return f.get(code)


def get_ownership(ticker: str, months: int = 12) -> dict:
    """Return the ownership time series + latest composition for one ticker.

    `ticker` may include the Yahoo ".JK" suffix; KSEI uses the bare code.
    Raises OwnershipError if not a single snapshot could be loaded.
    """
    code = ticker.strip().upper().removesuffix(".JK")
    if not code:
        raise OwnershipError("Ticker must not be empty.")

    series: list[dict] = []
    for cands in _month_end_candidates(months):
        # First candidate date that has a snapshot for this month wins.
        for ymd in cands:
            snap = _snapshot_for(code, ymd)
            if snap:
                series.append(snap)
                break
    if not series:
        raise OwnershipError(
            f"No KSEI ownership data for '{code}'. It may be a non-IDX ticker, "
            "or KSEI snapshots weren't reachable."
        )

    series.reverse()  # oldest first for the chart's left-to-right time axis
    latest = series[-1]

    def composition(snap: dict) -> dict:
        grand = snap["local_total"] + snap["foreign_total"]
        return {
            "date": snap["date"],
            "local": snap["local"],
            "foreign": snap["foreign"],
            "local_total": snap["local_total"],
            "foreign_total": snap["foreign_total"],
            "pct_foreign": (snap["foreign_total"] / grand * 100) if grand else 0.0,
            "pct_local": (snap["local_total"] / grand * 100) if grand else 0.0,
        }

    return {
        "ticker": code,
        "type_labels": TYPE_LABELS,
        "series": [composition(s) for s in series],
        "latest": composition(latest),
    }


def top_holders(ticker: str) -> list[dict]:
    """Best-effort top investor-type holdings for the latest snapshot.

    KSEI's file is aggregated by investor *type*, not by named entity, so this
    returns the largest Local/Foreign × type buckets (a transparent proxy for
    the ">1% owners" view until a named-holder source is wired in).
    """
    # Look back a few months so we still resolve the latest available snapshot
    # even early in a month before the current month-end file is published.
    data = get_ownership(ticker, months=3)
    snap = data["latest"]
    grand = snap["local_total"] + snap["foreign_total"]
    rows: list[dict] = []
    for scope, label_scope in (("local", "Lokal"), ("foreign", "Asing")):
        for t, lots in snap[scope].items():
            if lots <= 0:
                continue
            rows.append({
                "owner": f"{label_scope} {TYPE_LABELS[t]}",
                "scope": scope,
                "type": TYPE_LABELS[t],
                "lots": lots,
                "pct": (lots / grand * 100) if grand else 0.0,
            })
    rows.sort(key=lambda r: r["lots"], reverse=True)
    return rows


def demo() -> None:
    """Live self-check against KSEI for a well-known ticker."""
    data = get_ownership("BBCA", months=3)
    assert data["series"], "no series"
    latest = data["latest"]
    assert 0 <= latest["pct_foreign"] <= 100
    print(
        "ownership.demo OK:", data["ticker"],
        "snapshots", len(data["series"]),
        "foreign %.1f%%" % latest["pct_foreign"],
    )


if __name__ == "__main__":
    demo()
