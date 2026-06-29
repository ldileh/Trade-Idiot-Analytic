// TypeScript mirror of backend/app/models.py. Keep field names/types in sync
// with the FastAPI schemas — these decode straight from the JSON responses.

export type Interval = "1d" | "1wk" | "1mo" | "1h" | "30m" | "15m" | "5m" | "1m";
export type Range =
  | "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" | "10y" | "ytd" | "max";

export type IndicatorKind = "sma" | "ema" | "rsi" | "macd" | "bbands" | "atr";
export type Strategy = "sma_cross" | "rsi_reversion" | "trend_follow";

export interface Candle {
  time: number; // Unix epoch seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PricesResponse {
  ticker: string;
  interval: string;
  range: string;
  candles: Candle[];
}

export interface IndicatorSpec {
  kind: IndicatorKind;
  period: number;
}

export interface IndicatorRequest {
  ticker: string;
  interval?: Interval;
  range?: Range;
  indicators: IndicatorSpec[];
}

export interface IndicatorSeries {
  name: string;
  time: number[];
  value: (number | null)[]; // null during indicator warm-up (NaN on the backend)
}

export interface IndicatorResponse {
  ticker: string;
  series: IndicatorSeries[];
}

export interface BacktestRequest {
  ticker: string;
  interval?: Interval;
  range?: Range;
  strategy?: Strategy;
  fast?: number;
  slow?: number;
  rsi_period?: number;
  rsi_lower?: number;
  rsi_upper?: number;
  trend_period?: number;
  cash?: number;
  commission?: number;
}

export type PatternKind = "bullish" | "bearish" | "neutral";

export interface Pattern {
  key: string;
  label: string;
  kind: PatternKind;
  summary: string;
  detail: string;
  at: number | null; // Unix epoch seconds for a chart marker, or null
}

export interface PatternsResponse {
  ticker: string;
  bias: PatternKind;
  bias_text: string;
  patterns: Pattern[];
}

export type RRGQuadrant = "leading" | "weakening" | "lagging" | "improving";

export interface RRGPoint {
  x: number; // RS-Ratio (~100)
  y: number; // RS-Momentum (~100)
  time: number;
}

export interface RRGSymbol {
  symbol: string;
  quadrant: RRGQuadrant;
  tail: RRGPoint[];
}

export interface RRGResponse {
  benchmark: string;
  symbols: RRGSymbol[];
}

export interface EquityPoint {
  time: number;
  equity: number;
}

export interface BacktestResponse {
  ticker: string;
  strategy: string;
  stats: Record<string, number | string | null>;
  equity_curve: EquityPoint[];
}
