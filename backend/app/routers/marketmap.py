"""GET /marketmap — market cap + daily change for a batch of tickers (treemap)."""
from __future__ import annotations

from fastapi import APIRouter, Query

from app.models import MarketMapResponse
from app.services.marketmap import build_map

router = APIRouter(tags=["marketmap"])


@router.get("/marketmap", response_model=MarketMapResponse)
def get_marketmap(
    tickers: str = Query(..., description="Comma-separated tickers", examples=["BBCA.JK,BBRI.JK"]),
) -> MarketMapResponse:
    syms = [t for t in (tickers or "").split(",") if t.strip()]
    return MarketMapResponse(tiles=build_map(syms))
