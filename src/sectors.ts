// Sector groups for the Relative Rotation Graph. Each sector lists its member
// symbols and the benchmark to measure relative strength against. IDX sectors
// use the IDX Composite (^JKSE) as benchmark; US uses the S&P 500 (^GSPC).
export interface Sector {
  key: string;
  label: string;
  benchmark: string;
  symbols: string[];
}

export const SECTORS: Sector[] = [
  {
    key: "idx-finance",
    label: "IDX Finance (Perbankan)",
    benchmark: "^JKSE",
    symbols: ["BBCA.JK", "BBRI.JK", "BMRI.JK", "BBNI.JK", "BRIS.JK", "ARTO.JK", "BBTN.JK", "BBYB.JK"],
  },
  {
    key: "idx-bigcaps",
    label: "IDX Big Caps",
    benchmark: "^JKSE",
    symbols: ["BBCA.JK", "BBRI.JK", "TLKM.JK", "ASII.JK", "ICBP.JK", "UNVR.JK", "ANTM.JK", "ADRO.JK", "GOTO.JK", "AMRT.JK"],
  },
  {
    key: "idx-energy",
    label: "IDX Energy & Mining",
    benchmark: "^JKSE",
    symbols: ["ADRO.JK", "PTBA.JK", "ITMG.JK", "ANTM.JK", "INCO.JK", "MDKA.JK", "PGAS.JK", "MEDC.JK"],
  },
  {
    key: "us-megacap",
    label: "US Mega Cap Tech",
    benchmark: "^GSPC",
    symbols: ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META"],
  },
];
