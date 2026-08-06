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
  extended?: boolean; // bar is pre/post-market (US intraday only)
}

export interface PricesResponse {
  ticker: string;
  interval: string;
  range: string;
  source: "yahoo" | "finnhub"; // where the latest price came from
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

export type PatternAlign = "aligned" | "against" | "unclear";

export interface Pattern {
  key: string;
  label: string;
  kind: PatternKind;
  summary: string;
  detail: string;
  at: number | null; // Unix epoch seconds for a chart marker, or null
  align?: PatternAlign | null; // konteks tren EMA20/50; null = tidak berlaku
  align_text?: string;
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

export interface OwnershipComposition {
  date: string;
  local: Record<string, number>; // type suffix (IS/CP/PF/...) -> lots
  foreign: Record<string, number>;
  local_total: number;
  foreign_total: number;
  pct_foreign: number;
  pct_local: number;
}

export interface TopHolder {
  owner: string;
  scope: "local" | "foreign";
  type: string;
  lots: number;
  pct: number;
}

export interface OwnershipResponse {
  ticker: string;
  type_labels: Record<string, string>; // suffix -> Indonesian label
  series: OwnershipComposition[]; // oldest -> newest
  latest: OwnershipComposition;
  top_holders: TopHolder[];
}

export interface FundamentalMetric {
  key: string;
  label: string;
  group: string; // "Valuasi" | "Kesehatan" | "Pertumbuhan"
  tip: string;
  value: number | null;
  display: string;
  verdict: -1 | 0 | 1;
  verdict_text: string;
}

export interface PiotroskiScore {
  label: string;
  tip: string;
  score: number | null; // null = tidak cukup data
  max: number;
  enough_data: boolean;
  signals: { label: string; pass: boolean }[];
}

export interface AltmanScore {
  label: string;
  tip: string;
  score: number | null;
  zone: "safe" | "grey" | "distress" | null;
  zone_text: string;
  enough_data: boolean;
}

export interface FundamentalsResponse {
  ticker: string;
  name: string;
  score: number | null; // 0–100, null = rasio terlalu sedikit untuk dinilai
  bias: "good" | "neutral" | "bad" | "unknown";
  bias_text: string;
  metrics: FundamentalMetric[];
  piotroski?: PiotroskiScore | null;
  altman?: AltmanScore | null;
}

// Proksi jejak akumulasi/distribusi — BUKAN Broker Summary IDX.
export interface BandarmologyResponse {
  ticker: string;
  cmf: number | null;
  flow: "akumulasi" | "distribusi" | "netral" | null;
  flow_text: string;
  volume_ratio: number | null;
  volume_spike: boolean;
  volume_text: string;
  foreign_direction: "masuk" | "keluar" | "datar" | null;
  foreign_change_pp: number | null;
  foreign_text: string;
  headline: string;
  disclaimer: string;
}

export interface CorrelationPeer {
  sym: string;
  corr: number;
  strength: "Kuat" | "Sedang" | "Lemah";
}

export interface CorrelationResponse {
  ticker: string;
  enough_data: boolean;
  same: CorrelationPeer[];
  opposite: CorrelationPeer[];
}

export interface MarketMapTile {
  sym: string;
  market_cap: number | null;
  change_pct: number | null;
  price: number | null;
}

export interface MarketMapResponse {
  tiles: MarketMapTile[];
}

export interface MomentumReading {
  label: string; // "1 Bulan" | "3 Bulan" | "6 Bulan"
  pct: number | null;
  direction: "naik" | "turun" | "datar" | null;
  enough_data: boolean;
}

export interface Week52Position {
  enough_data: boolean;
  pct_of_high: number | null; // harga ÷ puncak 52 minggu, dalam %
  range_pos: number | null; // 0 = dasar rentang, 100 = puncak
  high: number | null;
  low: number | null;
  zone: "near_high" | "middle" | "near_low" | null;
  text: string;
}

export interface MomentumResponse {
  ticker: string;
  readings: MomentumReading[];
  volume_ok: boolean | null;
  volume_text: string;
  headline: string;
  week52?: Week52Position | null;
}

// --- Target Take Profit ---------------------------------------------------
// Mirror of backend/app/models.py. Semua angka adalah HARGA hasil hitungan dari
// data, bukan sinyal jual.

export interface TakeProfitTarget {
  label: string; // "2× ATR" | "2R" | "Puncak 52 minggu"
  price: number;
  pct_from_now: number;
  pct_from_entry: number | null; // null = user tidak punya posisi
  emphasis: boolean; // target utama yang disorot
  note?: string | null;
}

export interface TakeProfitMethod {
  key: "atr" | "rr" | "resistance";
  label: string;
  summary: string;
  why: string;
  reference: string;
  targets: TakeProfitTarget[];
  enough_data: boolean;
}

export interface TrailingStop {
  enough_data: boolean;
  triggered: boolean; // level sudah di atas harga = tren patah, bukan target
  label: string;
  price: number | null;
  highest_high: number | null;
  atr: number | null;
  pct_from_now: number | null;
  summary: string;
  why: string;
  reference: string;
}

export interface ScaleOutStep {
  portion: string;
  price: number | null;
  pct_from_now: number | null;
  note: string;
}

export type TakeProfitTrend = "uptrend" | "downtrend" | "sideways_up" | "sideways_down" | "unknown";
export type TakeProfitVol = "calm" | "normal" | "wild" | "unknown";
// Metode yang disarankan; "stop" = tren turun, fokus batasi rugi.
export type TakeProfitPick = "atr" | "rr" | "resistance" | "trailing" | "stop";

export interface TakeProfitCondition {
  trend: TakeProfitTrend;
  trend_text: string;
  vol: TakeProfitVol;
  vol_text: string;
  near_high: boolean;
  at_new_high: boolean;
  recommended: TakeProfitPick;
  recommended_label: string;
  recommended_why: string;
  recommended_reference: string;
}

export interface StopAdvice {
  enough_data: boolean;
  price: number | null;
  pct_from_now: number | null;
  pct_from_entry: number | null;
  method: string;
  summary: string;
  why: string;
  reference: string;
  risk_note: string;
}

export interface TakeProfitCandidate {
  sym: string;
  score: number;
  urgency: "high" | "medium" | "low";
  label: string;
  pnl_pct: number | null;
  price: number;
  reasons: string[];
  recommended: string;
  recommended_label: string;
  target: number | null;
  target_label: string | null;
  stop: number | null;
  trend: string;
}

export interface TakeProfitScreenResponse {
  candidates: TakeProfitCandidate[];
  skipped: string[];
}

export interface TakeProfitResponse {
  ticker: string;
  price: number;
  entry: number;
  has_position: boolean;
  underwater: boolean; // rugi > 2×ATR → target dihitung dari harga sekarang
  ahead: boolean; // untung > 2×ATR → target juga dihitung dari harga sekarang
  cost: number | null; // harga beli asli
  atr: number | null;
  atr_pct: number | null;
  stop: number | null;
  condition: TakeProfitCondition;
  stop_advice: StopAdvice;
  methods: TakeProfitMethod[];
  trailing: TrailingStop;
  plan: ScaleOutStep[];
  headline: string;
  disclaimer: string;
}

export interface NewsItem {
  title: string;
  publisher: string;
  url: string;
  time: number; // Unix epoch seconds, 0 if unknown
  sentiment: number; // -1 negatif, 0 netral, +1 positif
}

export interface NewsResponse {
  ticker: string;
  items: NewsItem[];
  sentiment: number; // sum of item sentiments
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
