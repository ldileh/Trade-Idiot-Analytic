"""POST /indicators — compute technical indicators for a ticker."""
from __future__ import annotations

import math

from fastapi import APIRouter, HTTPException

from app.models import IndicatorRequest, IndicatorResponse, IndicatorSeries
from app.services import indicators as indicator_service
from app.services.data import DataError
from app.services.provider import get_provider

router = APIRouter(tags=["indicators"])


def _to_value_list(series) -> list[float | None]:
    """Convert a pandas Series to JSON-safe values, NaN -> None."""
    out: list[float | None] = []
    for v in series.tolist():
        out.append(None if v is None or (isinstance(v, float) and math.isnan(v)) else float(v))
    return out


@router.post("/indicators", response_model=IndicatorResponse)
def compute_indicators(req: IndicatorRequest) -> IndicatorResponse:
    try:
        df = get_provider("prices").get_historical(req.ticker, req.interval, req.range)
    except DataError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    times = [int(ts.timestamp()) for ts in df.index]
    series_out: list[IndicatorSeries] = []

    for spec in req.indicators:
        try:
            lines = indicator_service.compute(df, spec.kind, spec.period)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        for name, s in lines.items():
            series_out.append(
                IndicatorSeries(name=name, time=times, value=_to_value_list(s))
            )

    return IndicatorResponse(ticker=req.ticker.strip().upper(), series=series_out)
