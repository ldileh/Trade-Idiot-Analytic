// Currency formatting that follows the ticker's market: IDX tickers (".JK")
// show Indonesian Rupiah (Rp, no decimals — IDX quotes whole rupiah), every
// other ticker shows US Dollars ($).
export function isIDX(ticker: string): boolean {
  return ticker.trim().toUpperCase().endsWith(".JK");
}

export function currencyFor(ticker: string): "IDR" | "USD" {
  return isIDX(ticker) ? "IDR" : "USD";
}

// Format a price/amount in the ticker's currency. IDR uses no decimals (whole
// rupiah, e.g. "Rp10.275"); USD keeps cents (e.g. "$182.34").
export function money(amount: number, ticker: string): string {
  if (isIDX(ticker)) {
    return amount.toLocaleString("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    });
  }
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// Just the symbol, for labels/placeholders ("Rp" or "$").
export function currencySymbol(ticker: string): string {
  return isIDX(ticker) ? "Rp" : "$";
}
