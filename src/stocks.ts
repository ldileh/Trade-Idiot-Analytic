// The searchable picker is backed by the full list of US-listed stocks & ETFs
// (the Gotrade universe), generated from the official Nasdaq Trader directory
// into src/stocks.data.ts. Regenerate with: node scripts/gen-stocks.mjs
// The picker also accepts any custom symbol typed by hand.
import { ALL_STOCKS } from "./stocks.data";

export interface Stock {
  sym: string;
  name: string;
}

export const STOCKS: Stock[] = ALL_STOCKS;

// A few popular picks surfaced as one-click chips above the search box.
export const POPULAR_SYMS = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA"];
