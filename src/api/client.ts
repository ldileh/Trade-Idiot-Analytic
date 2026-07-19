// Thin fetch wrapper around the FastAPI sidecar. The Tauri shell will pass the
// real port via env; default matches AGENTS.md (127.0.0.1:8756).
import type {
  BacktestRequest,
  BacktestResponse,
  CorrelationResponse,
  FundamentalsResponse,
  IndicatorRequest,
  IndicatorResponse,
  Interval,
  MarketMapResponse,
  MomentumResponse,
  NewsResponse,
  PatternsResponse,
  OwnershipResponse,
  PricesResponse,
  Range,
  RRGResponse,
} from "../types";
import { fundamentalsHeader, loadSettings, settingsHeaders } from "../settings";

// Browser-dev default; inside Tauri the real port comes from the shell (below).
export const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE ?? "http://127.0.0.1:8756";

// Inside the Tauri shell the backend listens on a free port chosen at startup;
// ask the Rust side for it once and cache. Outside Tauri, use BACKEND_BASE.
let basePromise: Promise<string> | null = null;
function backendBase(): Promise<string> {
  if (!basePromise) {
    basePromise = (async () => {
      if (!("__TAURI_INTERNALS__" in window)) return BACKEND_BASE;
      const { invoke } = await import("@tauri-apps/api/core");
      const port = await invoke<number>("backend_port");
      return `http://127.0.0.1:${port}`;
    })();
  }
  return basePromise;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = await backendBase();
  // Attach the user's Data Source (BYOK) choices as headers, read fresh each
  // call so a settings change takes effect on the next request. When everything
  // is default these are empty and the request is unchanged.
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...settingsHeaders(loadSettings()), ...init?.headers },
  });
  if (!res.ok) {
    // Surface FastAPI's `detail` when present. Custom errors give a string
    // ("fast period must be smaller than slow"); pydantic validation gives an
    // array of {msg, loc} — join those into one readable line.
    const detail = await res.json().then((b) => b?.detail).catch(() => null);
    const msg = Array.isArray(detail)
      ? detail.map((d: { msg?: string; loc?: unknown[] }) => `${d.loc?.slice(-1)}: ${d.msg}`).join("; ")
      : typeof detail === "string"
        ? detail
        : `${init?.method ?? "GET"} ${path} → ${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export function getPrices(
  ticker: string,
  interval: Interval = "1d",
  range: Range = "1y",
  prepost = false,
  realtime = true,
): Promise<PricesResponse> {
  const q = new URLSearchParams({ ticker, interval, range });
  if (prepost) q.set("prepost", "true");
  if (!realtime) q.set("realtime", "false");
  return request<PricesResponse>(`/prices?${q}`);
}

export function getPatterns(
  ticker: string,
  interval: Interval = "1d",
  range: Range = "1y",
): Promise<PatternsResponse> {
  const q = new URLSearchParams({ ticker, interval, range });
  return request<PatternsResponse>(`/patterns?${q}`);
}

export function getRRG(
  tickers: string[],
  benchmark = "^JKSE",
  interval: Interval = "1wk",
  range: Range = "1y",
  tail = 8,
): Promise<RRGResponse> {
  const q = new URLSearchParams({
    tickers: tickers.join(","),
    benchmark,
    interval,
    range,
    tail: String(tail),
  });
  return request<RRGResponse>(`/rrg?${q}`);
}

export function getNews(ticker: string, limit = 6): Promise<NewsResponse> {
  const q = new URLSearchParams({ ticker, limit: String(limit) });
  return request<NewsResponse>(`/news?${q}`);
}

export function getCorrelation(ticker: string, peers: string[], top = 5): Promise<CorrelationResponse> {
  const q = new URLSearchParams({ ticker, peers: peers.join(","), top: String(top) });
  return request<CorrelationResponse>(`/correlation?${q}`);
}

export function getMarketMap(tickers: string[]): Promise<MarketMapResponse> {
  const q = new URLSearchParams({ tickers: tickers.join(",") });
  return request<MarketMapResponse>(`/marketmap?${q}`);
}

export function getMomentum(
  ticker: string,
  interval: Interval = "1d",
): Promise<MomentumResponse> {
  const q = new URLSearchParams({ ticker, interval });
  return request<MomentumResponse>(`/momentum?${q}`);
}

export function getFundamentals(ticker: string): Promise<FundamentalsResponse> {
  const q = new URLSearchParams({ ticker });
  // Fundamentals source is chosen per market (US vs IDX), resolved from the ticker.
  return request<FundamentalsResponse>(`/fundamentals?${q}`, {
    headers: fundamentalsHeader(loadSettings(), ticker),
  });
}

export function getOwnership(ticker: string, months = 12): Promise<OwnershipResponse> {
  const q = new URLSearchParams({ ticker, months: String(months) });
  return request<OwnershipResponse>(`/ownership?${q}`);
}

export function postIndicators(body: IndicatorRequest): Promise<IndicatorResponse> {
  return request<IndicatorResponse>("/indicators", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function postBacktest(body: BacktestRequest): Promise<BacktestResponse> {
  return request<BacktestResponse>("/backtest", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
