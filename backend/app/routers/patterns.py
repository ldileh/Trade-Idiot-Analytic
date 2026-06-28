"""GET /patterns — detected chart patterns for a ticker, as a trading hint."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.models import Interval, Pattern, PatternsResponse, Range
from app.services.data import DataError, get_ohlcv
from app.services.patterns import detect

router = APIRouter(tags=["patterns"])


@router.get("/patterns", response_model=PatternsResponse)
def get_patterns(
    ticker: str = Query(..., examples=["AAPL"]),
    interval: Interval = "1d",
    range: Range = "1y",
) -> PatternsResponse:
    try:
        df = get_ohlcv(ticker, interval, range)
    except DataError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    bias, bias_text, patterns = detect(df)
    return PatternsResponse(
        ticker=ticker.strip().upper(),
        bias=bias,
        bias_text=bias_text,
        patterns=[Pattern(**p) for p in patterns],
    )
