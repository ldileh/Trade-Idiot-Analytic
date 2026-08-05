"""GET /bandarmology — proksi jejak akumulasi/distribusi (CMF + volume + KSEI).

Bukan Broker Summary: lihat catatan di services/bandarmology.py soal kenapa data
broker asli tidak dipakai.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.models import BandarmologyResponse, Interval
from app.services.bandarmology import compute
from app.services.data import DataError
from app.services.provider import get_provider

router = APIRouter(tags=["bandarmology"])


@router.get("/bandarmology", response_model=BandarmologyResponse)
def get_bandarmology(
    ticker: str = Query(..., examples=["BBCA.JK"]),
    interval: Interval = "1d",
) -> BandarmologyResponse:
    try:
        df = get_provider("prices").get_historical(ticker, interval, "1y")
    except DataError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    # Kepemilikan asing KSEI hanya ada untuk saham IDX, dan sifatnya pelengkap:
    # kalau gagal diambil, panel tetap tampil dengan CMF + volume saja.
    ownership_series = None
    if ticker.strip().upper().endswith(".JK"):
        try:
            ownership_series = get_provider("ownership").get_ownership_flow(ticker, months=12).get("series")
        except Exception:  # noqa: BLE001 — pelengkap, jangan menggagalkan panel
            ownership_series = None

    return BandarmologyResponse(ticker=ticker.strip().upper(), **compute(df, ownership_series))
