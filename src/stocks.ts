// A broad list of popular US tickers for the searchable picker, so a beginner
// can find a company by name without knowing its symbol. Modeled on the kind of
// US stocks & ETFs commonly available on retail apps like Gotrade. The picker
// still accepts any custom symbol typed by hand — this is just for convenience.
export interface Stock {
  sym: string;
  name: string;
}

export const STOCKS: Stock[] = [
  // --- Big tech / semiconductors ---
  { sym: "AAPL", name: "Apple" },
  { sym: "MSFT", name: "Microsoft" },
  { sym: "GOOGL", name: "Alphabet (Google) Kelas A" },
  { sym: "GOOG", name: "Alphabet (Google) Kelas C" },
  { sym: "AMZN", name: "Amazon" },
  { sym: "NVDA", name: "Nvidia" },
  { sym: "META", name: "Meta (Facebook)" },
  { sym: "AVGO", name: "Broadcom" },
  { sym: "AMD", name: "AMD" },
  { sym: "INTC", name: "Intel" },
  { sym: "QCOM", name: "Qualcomm" },
  { sym: "TXN", name: "Texas Instruments" },
  { sym: "MU", name: "Micron Technology" },
  { sym: "AMAT", name: "Applied Materials" },
  { sym: "ARM", name: "Arm Holdings" },
  { sym: "SMCI", name: "Super Micro Computer" },
  { sym: "TSM", name: "TSMC" },
  { sym: "CSCO", name: "Cisco" },
  { sym: "IBM", name: "IBM" },
  { sym: "ORCL", name: "Oracle" },
  { sym: "ADBE", name: "Adobe" },
  { sym: "CRM", name: "Salesforce" },
  { sym: "NOW", name: "ServiceNow" },
  { sym: "INTU", name: "Intuit" },
  { sym: "DELL", name: "Dell Technologies" },

  // --- Software / internet / fintech ---
  { sym: "NFLX", name: "Netflix" },
  { sym: "PLTR", name: "Palantir" },
  { sym: "SNOW", name: "Snowflake" },
  { sym: "CRWD", name: "CrowdStrike" },
  { sym: "PANW", name: "Palo Alto Networks" },
  { sym: "DDOG", name: "Datadog" },
  { sym: "NET", name: "Cloudflare" },
  { sym: "SHOP", name: "Shopify" },
  { sym: "UBER", name: "Uber" },
  { sym: "LYFT", name: "Lyft" },
  { sym: "ABNB", name: "Airbnb" },
  { sym: "DASH", name: "DoorDash" },
  { sym: "PYPL", name: "PayPal" },
  { sym: "SQ", name: "Block (Square)" },
  { sym: "COIN", name: "Coinbase" },
  { sym: "HOOD", name: "Robinhood" },
  { sym: "SOFI", name: "SoFi Technologies" },
  { sym: "NU", name: "Nu Holdings" },
  { sym: "RBLX", name: "Roblox" },
  { sym: "SNAP", name: "Snap" },
  { sym: "PINS", name: "Pinterest" },
  { sym: "SPOT", name: "Spotify" },
  { sym: "DKNG", name: "DraftKings" },
  { sym: "BABA", name: "Alibaba" },

  // --- Consumer / retail / food ---
  { sym: "WMT", name: "Walmart" },
  { sym: "COST", name: "Costco" },
  { sym: "TGT", name: "Target" },
  { sym: "HD", name: "Home Depot" },
  { sym: "LOW", name: "Lowe's" },
  { sym: "NKE", name: "Nike" },
  { sym: "LULU", name: "Lululemon" },
  { sym: "SBUX", name: "Starbucks" },
  { sym: "MCD", name: "McDonald's" },
  { sym: "CMG", name: "Chipotle" },
  { sym: "KO", name: "Coca-Cola" },
  { sym: "PEP", name: "PepsiCo" },
  { sym: "PG", name: "Procter & Gamble" },
  { sym: "MDLZ", name: "Mondelez" },
  { sym: "KHC", name: "Kraft Heinz" },
  { sym: "EL", name: "Estée Lauder" },
  { sym: "DIS", name: "Walt Disney" },
  { sym: "CMCSA", name: "Comcast" },

  // --- Autos / EV ---
  { sym: "TSLA", name: "Tesla" },
  { sym: "F", name: "Ford" },
  { sym: "GM", name: "General Motors" },
  { sym: "RIVN", name: "Rivian" },
  { sym: "LCID", name: "Lucid Group" },
  { sym: "NIO", name: "NIO" },

  // --- Finance ---
  { sym: "BRK-B", name: "Berkshire Hathaway B" },
  { sym: "JPM", name: "JPMorgan Chase" },
  { sym: "BAC", name: "Bank of America" },
  { sym: "WFC", name: "Wells Fargo" },
  { sym: "GS", name: "Goldman Sachs" },
  { sym: "MS", name: "Morgan Stanley" },
  { sym: "C", name: "Citigroup" },
  { sym: "V", name: "Visa" },
  { sym: "MA", name: "Mastercard" },
  { sym: "AXP", name: "American Express" },
  { sym: "BLK", name: "BlackRock" },
  { sym: "SCHW", name: "Charles Schwab" },

  // --- Health care ---
  { sym: "LLY", name: "Eli Lilly" },
  { sym: "JNJ", name: "Johnson & Johnson" },
  { sym: "UNH", name: "UnitedHealth" },
  { sym: "ABBV", name: "AbbVie" },
  { sym: "MRK", name: "Merck" },
  { sym: "PFE", name: "Pfizer" },
  { sym: "MRNA", name: "Moderna" },
  { sym: "TMO", name: "Thermo Fisher" },
  { sym: "AMGN", name: "Amgen" },
  { sym: "GILD", name: "Gilead Sciences" },
  { sym: "CVS", name: "CVS Health" },

  // --- Industrial / energy / telecom ---
  { sym: "XOM", name: "ExxonMobil" },
  { sym: "CVX", name: "Chevron" },
  { sym: "BA", name: "Boeing" },
  { sym: "CAT", name: "Caterpillar" },
  { sym: "GE", name: "General Electric" },
  { sym: "HON", name: "Honeywell" },
  { sym: "UPS", name: "UPS" },
  { sym: "FDX", name: "FedEx" },
  { sym: "LMT", name: "Lockheed Martin" },
  { sym: "RTX", name: "RTX (Raytheon)" },
  { sym: "T", name: "AT&T" },
  { sym: "VZ", name: "Verizon" },
  { sym: "TMUS", name: "T-Mobile US" },

  // --- Travel / airlines ---
  { sym: "AAL", name: "American Airlines" },
  { sym: "DAL", name: "Delta Air Lines" },
  { sym: "UAL", name: "United Airlines" },
  { sym: "BKNG", name: "Booking Holdings" },
  { sym: "MAR", name: "Marriott" },
  { sym: "CCL", name: "Carnival" },

  // --- Meme / misc popular ---
  { sym: "GME", name: "GameStop" },
  { sym: "AMC", name: "AMC Entertainment" },
  { sym: "PLUG", name: "Plug Power" },

  // --- Popular ETFs ---
  { sym: "SPY", name: "ETF S&P 500 (SPDR)" },
  { sym: "VOO", name: "ETF S&P 500 (Vanguard)" },
  { sym: "QQQ", name: "ETF Nasdaq-100 (Invesco)" },
  { sym: "VTI", name: "ETF Total US Market (Vanguard)" },
  { sym: "DIA", name: "ETF Dow Jones (SPDR)" },
  { sym: "IWM", name: "ETF Russell 2000 (saham kecil)" },
  { sym: "ARKK", name: "ETF ARK Innovation" },
  { sym: "SCHD", name: "ETF Dividen (Schwab)" },
  { sym: "GLD", name: "ETF Emas (SPDR Gold)" },
];

// A few popular picks surfaced as one-click chips above the search box.
export const POPULAR_SYMS = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA"];
