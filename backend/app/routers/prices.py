"""GET /prices — OHLCV candles for a ticker."""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Query

from app.models import Candle, Interval, PricesResponse, Range
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
    # BYOK: the user's own Finnhub key from the Data Source settings, sent as a
    # header so it never lands in the URL/query logs. Absent -> env key / delayed.
    x_key_finnhub: str | None = Header(default=None),
) -> PricesResponse:
    try:
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
