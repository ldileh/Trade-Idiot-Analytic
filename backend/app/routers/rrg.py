"""GET /rrg — Relative Rotation Graph paths for a set of tickers vs a benchmark."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.models import Interval, RRGResponse, Range
from app.services.data import DataError
from app.services.rrg import compute_rrg

router = APIRouter(tags=["rrg"])


@router.get("/rrg", response_model=RRGResponse)
def get_rrg(
    tickers: str = Query(..., description="Comma-separated symbols", examples=["BBCA.JK,BBRI.JK"]),
    benchmark: str = Query("^JKSE", description="Benchmark symbol (default IDX Composite)"),
    interval: Interval = "1wk",
    range: Range = "1y",
    tail: int = Query(8, ge=2, le=30, description="Number of trailing points per symbol"),
) -> RRGResponse:
    syms = [t for t in (s.strip() for s in tickers.split(",")) if t]
    if not syms:
        raise HTTPException(status_code=422, detail="At least one ticker is required.")
    try:
        data = compute_rrg(syms, benchmark, interval, range, tail)
    except DataError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if not data["symbols"]:
        raise HTTPException(
            status_code=404,
            detail="No symbols had enough data to plot. Try a longer range or fewer/known tickers.",
        )
    return RRGResponse(**data)
