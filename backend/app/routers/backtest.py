"""POST /backtest — run a strategy backtest and return stats + equity curve."""
from __future__ import annotations

import math

import pandas as pd
from fastapi import APIRouter, HTTPException

from app.models import BacktestRequest, BacktestResponse, EquityPoint
from app.services.data import DataError, get_ohlcv
from app.services.strategies import run_backtest

router = APIRouter(tags=["backtest"])

# Human-readable stats from backtesting.py worth surfacing; the rest (internal
# frames like _equity_curve/_trades/_strategy) are dropped before serializing.
_STAT_KEYS = [
    "Start",
    "End",
    "Duration",
    "Return [%]",
    "Buy & Hold Return [%]",
    "Return (Ann.) [%]",
    "Volatility (Ann.) [%]",
    "Sharpe Ratio",
    "Sortino Ratio",
    "Max. Drawdown [%]",
    "Win Rate [%]",
    "# Trades",
    "Profit Factor",
    "Expectancy [%]",
]


def _clean(value):
    """Coerce a stats value into something JSON-serializable."""
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, (pd.Timestamp, pd.Timedelta)):
        return str(value)
    if isinstance(value, float):
        return round(value, 4)
    if isinstance(value, (int, str)):
        return value
    return str(value)


@router.post("/backtest", response_model=BacktestResponse)
def run(req: BacktestRequest) -> BacktestResponse:
    try:
        df = get_ohlcv(req.ticker, req.interval, req.range)
    except DataError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    try:
        stats, equity_curve = run_backtest(df, req)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    selected = {key: _clean(stats.get(key)) for key in _STAT_KEYS if key in stats}

    points = [
        EquityPoint(time=int(ts.timestamp()), equity=round(float(eq), 2))
        for ts, eq in equity_curve["Equity"].items()
        if not math.isnan(eq)
    ]

    return BacktestResponse(
        ticker=req.ticker.strip().upper(),
        strategy=req.strategy,
        stats=selected,
        equity_curve=points,
    )
