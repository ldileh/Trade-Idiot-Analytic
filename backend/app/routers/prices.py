"""GET /prices — OHLCV candles for a ticker."""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Query

from app.models import Candle, Interval, PricesResponse, Range
from app.services.adapters import ProviderKeyError, build
from app.services.data import DataError
from app.services.provider import get_provider

router = APIRouter(tags=["prices"])


@router.get("/prices", response_model=PricesResponse)
def get_prices(
    ticker: str = Query(..., examples=["AAPL"]),
    interval: Interval = "1d",
    range: Range = "1y",
    prepost: bool = False,
    realtime: bool = True,
    # BYOK: the user's own keys from the Data Source settings, sent as headers so
    # they never land in the URL/query logs. Absent -> env key / delayed default.
    x_key_finnhub: str | None = Header(default=None),
    x_provider_prices: str | None = Header(default=None),
    x_key_twelvedata: str | None = Header(default=None),
) -> PricesResponse:
    try:
        df = None
        # Optional external bar source (Twelve Data); fall back to Yahoo on failure.
        if x_provider_prices and x_provider_prices != "finnhub":
            ext = build(x_provider_prices, x_key_twelvedata or "")
            if ext is not None:
                try:
                    df = ext.get_historical(ticker, interval, range, prepost, realtime)
                except (ProviderKeyError, DataError):
                    df = None
        if df is None:
            provider = get_provider("prices", finnhub_key=x_key_finnhub)
            df = provider.get_historical(ticker, interval, range, prepost, realtime)
    except DataError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    candles = [
        Candle(
            time=int(ts.timestamp()),
            open=float(row.Open),
            high=float(row.High),
            low=float(row.Low),
            close=float(row.Close),
            volume=float(row.Volume),
            extended=bool(row.Extended),
        )
        for ts, row in zip(df.index, df.itertuples(index=False))
    ]
    return PricesResponse(
        ticker=ticker.strip().upper(),
        interval=interval,
        range=range,
        source=df.attrs.get("source", "yahoo"),
        candles=candles,
    )
