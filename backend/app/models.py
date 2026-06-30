"""Pydantic request/response models shared across routers."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# yfinance-supported values, constrained so bad input fails fast with a 422.
Interval = Literal["1d", "1wk", "1mo", "1h", "30m", "15m", "5m", "1m"]
Range = Literal["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"]


class Candle(BaseModel):
    """One OHLCV bar. `time` is a Unix epoch (seconds) for lightweight-charts."""

    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float
    extended: bool = False  # bar falls outside US regular hours (pre/post-market)


class PricesResponse(BaseModel):
    ticker: str
    interval: str
    range: str
    source: Literal["yahoo", "finnhub"] = "yahoo"  # where the latest price came from
    candles: list[Candle]


class IndicatorSpec(BaseModel):
    """A single indicator to compute, e.g. {"kind": "ema", "period": 20}."""

    kind: Literal["sma", "ema", "rsi", "macd", "bbands", "atr"]
    period: int = Field(default=14, ge=1, le=500)


class IndicatorRequest(BaseModel):
    ticker: str
    interval: Interval = "1d"
    range: Range = "1y"
    indicators: list[IndicatorSpec] = Field(default_factory=list)


class IndicatorSeries(BaseModel):
    """A named indicator line. `time` aligns 1:1 with `value`."""

    name: str
    time: list[int]
    value: list[float | None]


class IndicatorResponse(BaseModel):
    ticker: str
    series: list[IndicatorSeries]


class BacktestRequest(BaseModel):
    ticker: str
    interval: Interval = "1d"
    range: Range = "1y"
    strategy: Literal["sma_cross", "rsi_reversion", "trend_follow"] = "sma_cross"
    fast: int = Field(default=10, ge=1, le=500)
    slow: int = Field(default=30, ge=1, le=500)
    rsi_period: int = Field(default=14, ge=2, le=200)
    rsi_lower: int = Field(default=30, ge=1, le=99)
    rsi_upper: int = Field(default=70, ge=1, le=99)
    trend_period: int = Field(default=200, ge=2, le=500)
    cash: float = Field(default=10_000, gt=0)
    commission: float = Field(default=0.002, ge=0, le=0.1)


class Pattern(BaseModel):
    """One detected chart pattern, used as a trading-decision hint."""

    key: str
    label: str
    kind: Literal["bullish", "bearish", "neutral"]
    summary: str
    detail: str
    at: int | None = None  # Unix seconds of the relevant bar, for a chart marker


class PatternsResponse(BaseModel):
    ticker: str
    bias: Literal["bullish", "bearish", "neutral"]
    bias_text: str
    patterns: list[Pattern]


class RRGPoint(BaseModel):
    """One point on a symbol's RRG path. x=RS-Ratio, y=RS-Momentum (~100)."""

    x: float
    y: float
    time: int


class RRGSymbol(BaseModel):
    symbol: str
    quadrant: Literal["leading", "weakening", "lagging", "improving"]
    tail: list[RRGPoint]


class RRGResponse(BaseModel):
    benchmark: str
    symbols: list[RRGSymbol]


class OwnershipComposition(BaseModel):
    """Local/Foreign × investor-type holdings for one month-end snapshot."""

    date: str
    local: dict[str, float]   # type-suffix -> lots (IS, CP, PF, ...)
    foreign: dict[str, float]
    local_total: float
    foreign_total: float
    pct_foreign: float
    pct_local: float


class TopHolder(BaseModel):
    owner: str
    scope: Literal["local", "foreign"]
    type: str
    lots: float
    pct: float


class OwnershipResponse(BaseModel):
    ticker: str
    type_labels: dict[str, str]
    series: list[OwnershipComposition]   # oldest -> newest, for the time chart
    latest: OwnershipComposition
    top_holders: list[TopHolder]


class FundamentalMetric(BaseModel):
    """One fundamental ratio with its plain-language verdict."""

    key: str
    label: str
    group: str  # "Valuasi" | "Kesehatan" | "Pertumbuhan"
    tip: str
    value: float | None  # None = field absent for this ticker
    display: str
    verdict: int  # +1 good, 0 neutral, -1 bad
    verdict_text: str


class FundamentalsResponse(BaseModel):
    ticker: str
    name: str
    score: int  # 0–100 composite health score
    bias: Literal["good", "neutral", "bad"]
    bias_text: str
    metrics: list[FundamentalMetric]


class EquityPoint(BaseModel):
    time: int
    equity: float


class BacktestResponse(BaseModel):
    ticker: str
    strategy: str
    stats: dict[str, float | int | str | None]
    equity_curve: list[EquityPoint]
