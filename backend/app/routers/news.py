"""GET /news — recent headlines + keyword sentiment for a ticker."""
from __future__ import annotations

from fastapi import APIRouter, Query

from app.models import NewsItem, NewsResponse
from app.services.news import get_news

router = APIRouter(tags=["news"])


@router.get("/news", response_model=NewsResponse)
def news(
    ticker: str = Query(..., examples=["AAPL"]),
    limit: int = Query(6, ge=1, le=20),
) -> NewsResponse:
    # Best-effort: get_news never raises, so no ticker check here — an unknown
    # ticker just comes back with an empty item list (neutral sentiment).
    data = get_news(ticker, limit)
    return NewsResponse(
        ticker=ticker.strip().upper(),
        items=[NewsItem(**i) for i in data["items"]],
        sentiment=data["sentiment"],
    )
