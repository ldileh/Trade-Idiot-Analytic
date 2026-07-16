"""GET /fundamentals — valuation/health/growth ratios with a composite score."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.models import FundamentalsResponse
from app.services.fundamentals import FundamentalsError
from app.services.provider import get_provider

router = APIRouter(tags=["fundamentals"])


@router.get("/fundamentals", response_model=FundamentalsResponse)
def fundamentals(ticker: str = Query(..., examples=["AAPL"])) -> FundamentalsResponse:
    try:
        return FundamentalsResponse(**get_provider("fundamentals").get_fundamentals(ticker))
    except FundamentalsError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
