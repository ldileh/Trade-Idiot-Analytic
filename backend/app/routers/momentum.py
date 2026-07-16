"""GET /momentum — multi-timeframe "Kekuatan Tren" (1/3/6mo) for a ticker."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.models import Interval, MomentumResponse
from app.services.data import DataError
from app.services.momentum import compute
from app.services.provider import get_provider

router = APIRouter(tags=["momentum"])


@router.get("/momentum", response_model=MomentumResponse)
def get_momentum(
    ticker: str = Query(..., examples=["AAPL"]),
    interval: Interval = "1d",
) -> MomentumResponse:
    # 1y of daily bars is enough for the 6-month formation period; it comes from
    # the SQLite cache (task 013), so this adds no network round-trip after the
    # first backfill.
    try:
        df = get_provider("prices").get_historical(ticker, interval, "1y")
    except DataError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return MomentumResponse(ticker=ticker.strip().upper(), **compute(df))
