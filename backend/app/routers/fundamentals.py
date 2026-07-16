"""GET /fundamentals — valuation/health/growth ratios with a composite score."""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Query

from app.models import FundamentalsResponse
from app.services.adapters import ProviderKeyError, build
from app.services.fundamentals import FundamentalsError
from app.services.provider import get_provider

router = APIRouter(tags=["fundamentals"])


@router.get("/fundamentals", response_model=FundamentalsResponse)
def fundamentals(
    ticker: str = Query(..., examples=["AAPL"]),
    # BYOK routing (task 017/018): pick an external fundamentals provider + key.
    x_provider_fundamentals: str | None = Header(default=None),
    x_key_fmp: str | None = Header(default=None),
    x_key_sectors: str | None = Header(default=None),
) -> FundamentalsResponse:
    # If the user chose an external provider and gave its key, use it; on any
    # provider failure (bad key / rate limit / schema) fall back to the default
    # Yahoo provider so the panel still works, surfacing the reason isn't fatal.
    keys = {"fmp": x_key_fmp, "sectors": x_key_sectors}
    provider = None
    if x_provider_fundamentals:
        provider = build(x_provider_fundamentals, keys.get(x_provider_fundamentals) or "")

    try:
        if provider is not None:
            try:
                return FundamentalsResponse(**provider.get_fundamentals(ticker))
            except (ProviderKeyError, FundamentalsError):
                pass  # fall back to default below
        return FundamentalsResponse(**get_provider("fundamentals").get_fundamentals(ticker))
    except FundamentalsError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
