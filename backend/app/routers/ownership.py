"""GET /ownership — KSEI share-ownership composition & history for a ticker.

Powers the "Analisa Kepemilikan" (holder composition) and "Balance Position"
(Local/Foreign × type over time) views. Data is from KSEI's public month-end
archive; it is aggregated by investor *type*, not by named entity.
"""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Query

from app.models import OwnershipResponse
from app.services.adapters import ProviderKeyError, build
from app.services.ownership import OwnershipError
from app.services.provider import get_provider

router = APIRouter(tags=["ownership"])


@router.get("/ownership", response_model=OwnershipResponse)
def get_ownership_endpoint(
    ticker: str = Query(..., examples=["BBCA.JK"]),
    months: int = Query(12, ge=1, le=36, description="Month-end snapshots to include"),
    # BYOK: optional Sectors.app ownership source; falls back to KSEI on failure.
    x_provider_ownership: str | None = Header(default=None),
    x_key_sectors: str | None = Header(default=None),
) -> OwnershipResponse:
    provider = None
    if x_provider_ownership:
        provider = build(x_provider_ownership, x_key_sectors or "")

    try:
        if provider is not None:
            try:
                return OwnershipResponse(**provider.get_ownership_flow(ticker, months))
            except (ProviderKeyError, OwnershipError):
                pass  # fall back to default KSEI below
        data = get_provider("ownership").get_ownership_flow(ticker, months)
    except OwnershipError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return OwnershipResponse(**data)
