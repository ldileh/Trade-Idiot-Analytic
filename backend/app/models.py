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
    # where the latest price came from ("cache" = served from the local SQLite
    # bar cache, backfilled from stooq/yahoo — see services/bars_cache.py)
    source: Literal["yahoo", "finnhub", "cache", "stooq"] = "yahoo"
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


class PiotroskiScore(BaseModel):
    """Skor Kesehatan Keuangan — Piotroski F-Score (0–9)."""

    label: str
    tip: str
    score: int | None  # None = tidak cukup data
    max: int = 9
    enough_data: bool
    signals: list[dict]  # [{label, pass}] for the signals we could judge


class AltmanScore(BaseModel):
    """Skor Risiko Bangkrut — Altman Z-Score + distress zone."""

    label: str
    tip: str
    score: float | None  # None = tidak cukup data
    zone: Literal["safe", "grey", "distress"] | None
    zone_text: str
    enough_data: bool


class FundamentalsResponse(BaseModel):
    ticker: str
    name: str
    score: int  # 0–100 composite health score
    bias: Literal["good", "neutral", "bad"]
    bias_text: str
    metrics: list[FundamentalMetric]
    piotroski: PiotroskiScore | None = None  # Skor Kesehatan Keuangan
    altman: AltmanScore | None = None        # Skor Risiko Bangkrut


class CorrelationPeer(BaseModel):
    """One peer's return-correlation with the active symbol."""

    sym: str
    corr: float  # Pearson correlation of daily returns, -1..1
    strength: Literal["Kuat", "Sedang", "Lemah"]


class CorrelationResponse(BaseModel):
    ticker: str
    enough_data: bool
    same: list[CorrelationPeer]      # move together (positive)
    opposite: list[CorrelationPeer]  # move opposite (negative)


class MarketMapTile(BaseModel):
    """One treemap box: size = market_cap, color = change_pct."""

    sym: str
    market_cap: float | None  # None = unknown (rendered at placeholder size)
    change_pct: float | None
    price: float | None


class MarketMapResponse(BaseModel):
    tiles: list[MarketMapTile]


class MomentumReading(BaseModel):
    """One formation-period momentum reading (1/3/6 bulan)."""

    label: str  # "1 Bulan" | "3 Bulan" | "6 Bulan"
    pct: float | None  # cumulative return %, None if not enough history
    direction: Literal["naik", "turun", "datar"] | None
    enough_data: bool


class MomentumResponse(BaseModel):
    ticker: str
    readings: list[MomentumReading]
    volume_ok: bool | None  # OBV-confirmed up-move ("Minat Beli"), None if sparse
    volume_text: str
    headline: str


class NewsItem(BaseModel):
    """One recent headline for a ticker with a crude per-headline sentiment."""

    title: str
    publisher: str
    url: str
    time: int  # Unix epoch seconds, 0 if unknown
    sentiment: int  # -1 negatif, 0 netral, +1 positif (lexicon count)


class NewsResponse(BaseModel):
    ticker: str
    items: list[NewsItem]
    sentiment: int  # sum of item sentiments; >0 = arus berita cenderung positif


class EquityPoint(BaseModel):
    time: int
    equity: float


class BacktestResponse(BaseModel):
    ticker: str
    strategy: str
    stats: dict[str, float | int | str | None]
    equity_curve: list[EquityPoint]
