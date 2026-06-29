// Sector groups for the Relative Rotation Graph. Each sector lists its member
// symbols and the benchmark to measure relative strength against. IDX sectors
// benchmark to the IDX Composite (^JKSE / IHSG); US sectors to the S&P 500 (^GSPC).
import type { Market } from "./stocks";

export interface Sector {
  key: string;
  label: string;
  market: Market;
  benchmark: string;
  symbols: string[];
}

export const SECTORS: Sector[] = [
  {
    key: "idx-finance",
    label: "IDX Finance (Perbankan)",
    market: "id",
    benchmark: "^JKSE",
    symbols: ["BBCA.JK", "BBRI.JK", "BMRI.JK", "BBNI.JK", "BRIS.JK", "ARTO.JK", "BBTN.JK", "BBYB.JK"],
  },
  {
    key: "idx-bigcaps",
    label: "IDX Big Caps",
    market: "id",
    benchmark: "^JKSE",
    symbols: ["BBCA.JK", "BBRI.JK", "TLKM.JK", "ASII.JK", "ICBP.JK", "UNVR.JK", "ANTM.JK", "ADRO.JK", "GOTO.JK", "AMRT.JK"],
  },
  {
    key: "idx-energy",
    label: "IDX Energy & Mining",
    market: "id",
    benchmark: "^JKSE",
    symbols: ["ADRO.JK", "PTBA.JK", "ITMG.JK", "ANTM.JK", "INCO.JK", "MDKA.JK", "PGAS.JK", "MEDC.JK"],
  },
  {
    key: "us-tech",
    label: "US Tech (Big Tech)",
    market: "us",
    benchmark: "^GSPC",
    symbols: ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "AVGO", "AMD"],
  },
  {
    key: "us-finance",
    label: "US Finance (Banks)",
    market: "us",
    benchmark: "^GSPC",
    symbols: ["JPM", "BAC", "WFC", "C", "GS", "MS", "V", "MA"],
  },
  {
    key: "us-energy",
    label: "US Energy",
    market: "us",
    benchmark: "^GSPC",
    symbols: ["XOM", "CVX", "COP", "SLB", "EOG", "PSX", "MPC", "OXY"],
  },
];
