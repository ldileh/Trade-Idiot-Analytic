// Thin fetch wrapper around the FastAPI sidecar. The Tauri shell will pass the
// real port via env; default matches AGENTS.md (127.0.0.1:8756).
import type {
  BacktestRequest,
  BacktestResponse,
  IndicatorRequest,
  IndicatorResponse,
  Interval,
  PricesResponse,
  Range,
} from "../types";

export const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE ?? "http://127.0.0.1:8756";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function getPrices(
  ticker: string,
  interval: Interval = "1d",
  range: Range = "1y",
): Promise<PricesResponse> {
  const q = new URLSearchParams({ ticker, interval, range });
  return request<PricesResponse>(`/prices?${q}`);
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
