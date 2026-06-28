import { useState } from "react";
import { postBacktest } from "../api/client";
import type { BacktestRequest, BacktestResponse, Interval, Range, Strategy } from "../types";
import { STAT_INFO, STRATEGY_INFO } from "../help";
import { InfoTip } from "./ui";
import EquityChart from "./EquityChart";

const STRATEGIES: Strategy[] = ["sma_cross", "rsi_reversion"];

// Order stats are shown in (only those present render). Keeps the most useful
// numbers first so a beginner reads top-to-bottom.
const STAT_ORDER = [
  "Return [%]",
  "Buy & Hold Return [%]",
  "Win Rate [%]",
  "# Trades",
  "Max. Drawdown [%]",
  "Sharpe Ratio",
  "Profit Factor",
  "Expectancy [%]",
  "Return (Ann.) [%]",
  "Volatility (Ann.) [%]",
  "Sortino Ratio",
  "Start",
  "End",
  "Duration",
];

function fmt(key: string, v: number | string | null): string {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  if (key.includes("[%]")) return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

// Color a stat by whether its value is "good": +1 higher-is-better.
function toneFor(key: string, v: number | string | null): "pos" | "neg" | "neutral" {
  const info = STAT_INFO[key];
  if (!info || typeof v !== "number") return "neutral";
  if (info.good === 1) return v >= 0 ? "pos" : "neg";
  return "neutral";
}

export default function BacktestPanel({
  ticker,
  interval,
  range,
}: {
  ticker: string;
  interval: Interval;
  range: Range;
}) {
  const [strategy, setStrategy] = useState<Strategy>("sma_cross");
  const [result, setResult] = useState<BacktestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const num = (name: string) => Number((form.elements.namedItem(name) as HTMLInputElement).value);
    const body: BacktestRequest = {
      ticker, interval, range, strategy,
      fast: num("fast"), slow: num("slow"),
      rsi_period: num("rsi_period"), rsi_lower: num("rsi_lower"), rsi_upper: num("rsi_upper"),
      cash: num("cash"), commission: num("commission"),
    };
    setLoading(true);
    setError(null);
    postBacktest(body)
      .then(setResult)
      .catch((err: unknown) => {
        setResult(null);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }

  const isSma = strategy === "sma_cross";

  return (
    <div>
      <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>
        Backtest = mencoba strategi pada data harga <b>{ticker}</b> di masa lalu, untuk melihat
        seandainya dijalankan dulu, hasilnya untung atau rugi. Ini simulasi, bukan jaminan masa depan.
      </p>

      <div className="strat-grid" style={{ marginBottom: 6 }}>
        {STRATEGIES.map((s) => {
          const info = STRATEGY_INFO[s];
          return (
            <div
              key={s}
              className={`strat-card${strategy === s ? " active" : ""}`}
              role="button"
              tabIndex={0}
              aria-pressed={strategy === s}
              onClick={() => setStrategy(s)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setStrategy(s); }
              }}
            >
              <div className="title">{info.emoji} {info.label} {strategy === s && <span className="tick">✓</span>}</div>
              <div className="desc">{info.desc}</div>
            </div>
          );
        })}
      </div>

      <form onSubmit={run}>
        <div className="params">
          <Field name="fast" label="Garis cepat (hari)" tip="Rata-rata harga jangka pendek yang lincah. Saat memotong garis lambat ke atas → sinyal beli." defaultValue={10} hidden={!isSma} />
          <Field name="slow" label="Garis lambat (hari)" tip="Rata-rata harga jangka panjang yang kalem, jadi pembanding garis cepat." defaultValue={30} hidden={!isSma} />
          <Field name="rsi_period" label="Panjang meteran RSI" tip="RSI dihitung dari berapa hari terakhir. Umumnya 14." defaultValue={14} hidden={isSma} />
          <Field name="rsi_lower" label="Batas 'kemurahan'" tip="Kalau RSI turun di bawah angka ini, dianggap murah → beli. Umumnya 30." defaultValue={30} hidden={isSma} />
          <Field name="rsi_upper" label="Batas 'kemahalan'" tip="Kalau RSI naik di atas angka ini, dianggap mahal → jual. Umumnya 70." defaultValue={70} hidden={isSma} />
          <Field name="cash" label="Modal awal ($)" tip="Uang awal yang dipakai untuk simulasi. Contoh: 10000 = $10.000." defaultValue={10000} />
          <Field name="commission" label="Biaya per transaksi" tip="Potongan biaya tiap beli/jual. 0.002 berarti 0,2%." defaultValue={0.002} step={0.001} />
        </div>

        <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 16 }}>
          {loading ? "Menghitung…" : "▶ Jalankan simulasi"}
        </button>
        {loading && <div className="loading-bar" />}
      </form>

      {error && <div className="alert" role="alert">{error}</div>}

      {result && <Result result={result} />}
    </div>
  );
}

function Result({ result }: { result: BacktestResponse }) {
  const ret = Number(result.stats["Return [%]"]);
  const bh = Number(result.stats["Buy & Hold Return [%]"]);
  const beats = Number.isFinite(ret) && Number.isFinite(bh) && ret >= bh;
  const profit = Number.isFinite(ret) && ret > 0;

  const verdict = !Number.isFinite(ret)
    ? { cls: "bad", emoji: "🤔", text: "Strategi tidak menghasilkan transaksi pada periode ini — coba ubah pengaturan atau saham lain." }
    : profit && beats
      ? { cls: "good", emoji: "🎉", text: `Mantap! Strategi ini untung ${ret.toFixed(2)}% dan mengalahkan sekadar "beli lalu diamkan".` }
      : profit
        ? { cls: "good", emoji: "🙂", text: `Strategi ini untung ${ret.toFixed(2)}%, tapi kalah dibanding sekadar "beli lalu diamkan" (${bh.toFixed(2)}%).` }
        : { cls: "bad", emoji: "😕", text: `Strategi ini rugi ${ret.toFixed(2)}% pada periode ini. Coba pengaturan atau saham lain.` };

  const entries = STAT_ORDER.filter((k) => k in result.stats).map((k) => [k, result.stats[k]] as const);

  return (
    <>
      <div className={`verdict ${verdict.cls}`} style={{ marginTop: 18 }}>
        <span className="emoji">{verdict.emoji}</span>
        <span>{verdict.text}</span>
      </div>

      <div className="stat-grid">
        {entries.map(([k, v]) => {
          const info = STAT_INFO[k];
          return (
            <div key={k} className={`stat ${toneFor(k, v)}`}>
              <div className="k">
                {info?.label ?? k}
                {info && <InfoTip text={info.tip} />}
              </div>
              <div className="v">{fmt(k, v)}</div>
            </div>
          );
        })}
      </div>

      <p className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
        Grafik di bawah: perkembangan modalmu dari waktu ke waktu kalau mengikuti strategi ini.
      </p>
      <div className="chart-wrap">
        <EquityChart points={result.equity_curve} />
      </div>
    </>
  );
}

// Hidden fields stay in the form (and in form.elements) so every strategy's
// params post, but only the active strategy's fields are visible.
function Field({
  name, label, tip, defaultValue, step, hidden,
}: {
  name: string;
  label: string;
  tip: string;
  defaultValue: number;
  step?: number;
  hidden?: boolean;
}) {
  return (
    <label className="field" style={{ display: hidden ? "none" : undefined }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {label} <InfoTip text={tip} />
      </span>
      <input name={name} type="number" defaultValue={defaultValue} step={step} />
    </label>
  );
}
