// A curated list of well-known US tickers for the searchable picker, so a
// beginner can find a company by name without knowing its symbol. The picker
// still accepts any custom symbol typed by hand — this is just for convenience.
export interface Stock {
  sym: string;
  name: string;
}

export const STOCKS: Stock[] = [
  { sym: "AAPL", name: "Apple" },
  { sym: "MSFT", name: "Microsoft" },
  { sym: "GOOGL", name: "Alphabet (Google)" },
  { sym: "AMZN", name: "Amazon" },
  { sym: "NVDA", name: "Nvidia" },
  { sym: "META", name: "Meta (Facebook)" },
  { sym: "TSLA", name: "Tesla" },
  { sym: "NFLX", name: "Netflix" },
  { sym: "AMD", name: "AMD" },
  { sym: "INTC", name: "Intel" },
  { sym: "DIS", name: "Walt Disney" },
  { sym: "KO", name: "Coca-Cola" },
  { sym: "PEP", name: "PepsiCo" },
  { sym: "MCD", name: "McDonald's" },
  { sym: "SBUX", name: "Starbucks" },
  { sym: "NKE", name: "Nike" },
  { sym: "V", name: "Visa" },
  { sym: "MA", name: "Mastercard" },
  { sym: "JPM", name: "JPMorgan Chase" },
  { sym: "BAC", name: "Bank of America" },
  { sym: "WMT", name: "Walmart" },
  { sym: "COST", name: "Costco" },
  { sym: "PFE", name: "Pfizer" },
  { sym: "JNJ", name: "Johnson & Johnson" },
  { sym: "XOM", name: "ExxonMobil" },
  { sym: "BA", name: "Boeing" },
  { sym: "UBER", name: "Uber" },
  { sym: "ABNB", name: "Airbnb" },
  { sym: "PYPL", name: "PayPal" },
  { sym: "ADBE", name: "Adobe" },
  { sym: "CRM", name: "Salesforce" },
  { sym: "ORCL", name: "Oracle" },
  { sym: "QCOM", name: "Qualcomm" },
  { sym: "GME", name: "GameStop" },
  { sym: "F", name: "Ford" },
  { sym: "GM", name: "General Motors" },
];

// A few popular picks surfaced as one-click chips above the search box.
export const POPULAR_SYMS = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA"];
