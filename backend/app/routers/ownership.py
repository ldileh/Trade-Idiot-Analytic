"""GET /ownership — KSEI share-ownership composition & history for a ticker.

Powers the "Analisa Kepemilikan" (holder composition) and "Balance Position"
(Local/Foreign × type over time) views. Data is from KSEI's public month-end
archive; it is aggregated by investor *type*, not by named entity.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.models import OwnershipResponse
from app.services.ownership import OwnershipError, get_ownership, top_holders

router = APIRouter(tags=["ownership"])


@router.get("/ownership", response_model=OwnershipResponse)
def get_ownership_endpoint(
    ticker: str = Query(..., examples=["BBCA.JK"]),
    months: int = Query(12, ge=1, le=36, description="Month-end snapshots to include"),
) -> OwnershipResponse:
    try:
        data = get_ownership(ticker, months)
        holders = top_holders(ticker)
    except OwnershipError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return OwnershipResponse(**data, top_holders=holders)
