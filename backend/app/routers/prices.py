"""GET /prices — OHLCV candles for a ticker."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.models import Candle, Interval, PricesResponse, Range
from app.services.data import DataError, get_ohlcv

router = APIRouter(tags=["prices"])


@router.get("/prices", response_model=PricesResponse)
def get_prices(
    ticker: str = Query(..., examples=["AAPL"]),
    interval: Interval = "1d",
    range: Range = "1y",
    prepost: bool = False,
    realtime: bool = True,
) -> PricesResponse:
    try:
        df = get_ohlcv(ticker, interval, range, prepost, realtime)
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
