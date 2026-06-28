// Thin fetch wrapper around the FastAPI sidecar. The Tauri shell will pass the
// real port via env; default matches AGENTS.md (127.0.0.1:8756).
import type {
  BacktestRequest,
  BacktestResponse,
  IndicatorRequest,
  IndicatorResponse,
  Interval,
  PatternsResponse,
  PricesResponse,
  Range,
} from "../types";

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
  const res = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
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
): Promise<PricesResponse> {
  const q = new URLSearchParams({ ticker, interval, range });
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
