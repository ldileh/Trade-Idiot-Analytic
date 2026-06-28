// The searchable picker is backed by two market universes:
//  - US:  src/stocks.data.ts    (Nasdaq Trader directory)  — node scripts/gen-stocks.mjs
//  - IDX: src/stocks.id.data.ts (all IDX emiten, .JK suffix) — node scripts/gen-stocks-id.mjs
// The picker also accepts any custom symbol typed by hand.
import { ALL_STOCKS } from "./stocks.data";
import { ID_STOCKS } from "./stocks.id.data";

export interface Stock {
  sym: string;
  name: string;
}

export type Market = "us" | "id";

// Per-market lists so the search can show only the selected market's stocks.
export const STOCKS_BY_MARKET: Record<Market, Stock[]> = {
  us: ALL_STOCKS,
  id: ID_STOCKS,
};

// Quick-pick chips per market, shown above the search box.
export const POPULAR_SYMS_BY_MARKET: Record<Market, string[]> = {
  us: ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA"],
  id: ["BBCA.JK", "BBRI.JK", "BMRI.JK", "TLKM.JK", "ASII.JK", "GOTO.JK"],
};
