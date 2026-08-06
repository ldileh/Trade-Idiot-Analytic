"""GET /takeprofit — target harga jual (take profit) untuk satu saham."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.models import Interval, TakeProfitResponse, TakeProfitScreenResponse
from app.services.data import DataError
from app.services.provider import get_provider
from app.services.takeprofit import compute, screen

router = APIRouter(tags=["takeprofit"])


@router.get("/takeprofit", response_model=TakeProfitResponse)
def get_takeprofit(
    ticker: str = Query(..., examples=["AAPL"]),
    interval: Interval = "1d",
    # Harga beli rata-rata user (dari portofolio di frontend). Bila kosong,
    # target dihitung seolah masuk di harga sekarang.
    buy_price: float | None = Query(None, gt=0, description="Harga beli rata-rata per lembar"),
    # Batas rugi milik user; tanpa ini dipakai stop 1×ATR (Wilder) untuk R-multiple.
    stop_price: float | None = Query(None, gt=0, description="Batas rugi (stop loss) per lembar"),
) -> TakeProfitResponse:
    # 1y daily bars: cukup untuk ATR-14, Chandelier-22, dan puncak 52 minggu.
    # Datang dari cache SQLite, jadi tidak ada round-trip jaringan tambahan.
    try:
        df = get_provider("prices").get_historical(ticker, interval, "1y")
    except DataError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return TakeProfitResponse(
        ticker=ticker.strip().upper(), **compute(df, buy_price=buy_price, stop_price=stop_price)
    )


@router.get("/takeprofit/screen", response_model=TakeProfitScreenResponse)
def screen_portfolio(
    # Format "KODE:HARGA_BELI", dipisah koma — mis. "BBCA.JK:9000,AAPL:180".
    # Harga beli wajib: tanpa itu untung/rugi tak bisa dinilai, dan screening
    # take profit tanpa untung/rugi tidak berarti apa-apa.
    holdings: str = Query(..., examples=["BBCA.JK:9000,AAPL:180"]),
    interval: Interval = "1d",
) -> TakeProfitScreenResponse:
    rows: list[dict] = []
    skipped: list[str] = []

    for part in holdings.split(","):
        part = part.strip()
        if not part:
            continue
        sym, _, raw_price = part.partition(":")
        sym = sym.strip().upper()
        if not sym:
            continue
        try:
            buy = float(raw_price) if raw_price.strip() else None
        except ValueError:
            buy = None

        try:
            df = get_provider("prices").get_historical(sym, interval, "1y")
            result = compute(df, buy_price=buy)
        except (DataError, KeyError, ValueError, IndexError):
            # Satu kode bermasalah tidak boleh menggagalkan seluruh portofolio.
            skipped.append(sym)
            continue

        pnl = ((result["price"] / buy - 1.0) * 100) if buy and buy > 0 else None
        rows.append({"sym": sym, "result": result, "pnl_pct": pnl})

    return TakeProfitScreenResponse(candidates=screen(rows), skipped=skipped)
