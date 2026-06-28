// At-a-glance, plain-language snapshot of the loaded stock: latest price, how
// much it moved over the shown period, and the period high/low. Everything is
// derived from the candles already fetched — no extra request.
import type { Candle } from "../types";
import { InfoTip } from "./ui";

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function PriceSummary({ ticker, candles }: { ticker: string; candles: Candle[] }) {
  if (candles.length === 0) return null;

  const first = candles[0].close;
  const last = candles[candles.length - 1].close;
  const change = last - first;
  const pct = first !== 0 ? (change / first) * 100 : 0;
  const up = change >= 0;
  const high = Math.max(...candles.map((c) => c.high));
  const low = Math.min(...candles.map((c) => c.low));

  return (
    <div className="summary">
      <div className="big">
        <span className="price">{usd(last)}</span>
        <span className={`pill ${up ? "up" : "down"}`}>
          {up ? "▲" : "▼"} {usd(Math.abs(change))} ({up ? "+" : "−"}
          {Math.abs(pct).toFixed(2)}%)
        </span>
        <span className="muted" style={{ fontSize: 13 }}>
          harga terakhir <b>{ticker}</b> selama periode ini
        </span>
      </div>

      <div className="mini">
        <div className="k">
          Harga awal periode{" "}
          <InfoTip text="Harga di awal rentang waktu yang kamu pilih. Dibandingkan dengan harga terakhir untuk tahu naik/turun." />
        </div>
        <div className="v">{usd(first)}</div>
      </div>
      <div className="mini">
        <div className="k">Tertinggi 🔼</div>
        <div className="v" style={{ color: "var(--up)" }}>{usd(high)}</div>
      </div>
      <div className="mini">
        <div className="k">Terendah 🔽</div>
        <div className="v" style={{ color: "var(--down)" }}>{usd(low)}</div>
      </div>
    </div>
  );
}
