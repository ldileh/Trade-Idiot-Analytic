"""GET /correlation — "Saham yang Gerak Bareng" for a symbol vs candidate peers."""
from __future__ import annotations

from fastapi import APIRouter, Query

from app.models import CorrelationResponse
from app.services.correlation import correlate

router = APIRouter(tags=["correlation"])


@router.get("/correlation", response_model=CorrelationResponse)
def get_correlation(
    ticker: str = Query(..., examples=["BBCA.JK"]),
    peers: str = Query(..., description="Comma-separated candidate peers"),
    top: int = Query(5, ge=1, le=15),
) -> CorrelationResponse:
    peer_list = [p for p in (peers or "").split(",") if p.strip()]
    return CorrelationResponse(**correlate(ticker, peer_list, top))
