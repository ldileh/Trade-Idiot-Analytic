import { useState } from "react";
import { postBacktest } from "../api/client";
import type { BacktestRequest, BacktestResponse, Interval, Range, Strategy } from "../types";
import { STAT_INFO, STRATEGY_INFO } from "../help";
import { InfoTip } from "./ui";
import EquityChart from "./EquityChart";

const STRATEGIES: Strategy[] = ["sma_cross", "rsi_reversion", "trend_follow"];

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
      trend_period: num("trend_period"),
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
  const isRsi = strategy === "rsi_reversion";
  const isTrend = strategy === "trend_follow";

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

      <div className="how-box">
        <div className="how-title">Cara kerja "{STRATEGY_INFO[strategy].label}" — patokannya:</div>
        <ul>
          {STRATEGY_INFO[strategy].how.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <form onSubmit={run}>
        <div className="params">
          <Field name="fast" label="Garis cepat: rata-rata berapa hari?" tip="Garis cepat = rata-rata harga penutupan beberapa hari terakhir. Makin kecil makin lincah. Mis. 10. Harus lebih kecil dari garis lambat." defaultValue={10} hidden={!isSma} />
          <Field name="slow" label="Garis lambat: rata-rata berapa hari?" tip="Garis lambat = rata-rata harga penutupan lebih banyak hari, jadi pembanding yang kalem. Mis. 30. Harus lebih besar dari garis cepat." defaultValue={30} hidden={!isSma} />
          <Field name="rsi_period" label="Meteran RSI dihitung dari berapa hari?" tip="RSI dihitung dari pergerakan beberapa hari terakhir. Umumnya 14." defaultValue={14} hidden={!isRsi} />
          <Field name="rsi_lower" label="Batas 'kemurahan' (angka RSI 0–100)" tip="Angka pada meteran RSI (0–100), bukan harga. Saat RSI turun DI BAWAH angka ini → dianggap murah → beli. Umumnya 30." defaultValue={30} hidden={!isRsi} />
          <Field name="rsi_upper" label="Batas 'kemahalan' (angka RSI 0–100)" tip="Angka pada meteran RSI (0–100), bukan harga. Saat RSI naik DI ATAS angka ini → dianggap mahal → jual. Umumnya 70." defaultValue={70} hidden={!isRsi} />
          <Field name="trend_period" label="Garis tren panjang: rata-rata berapa hari?" tip="Garis tren besar dari rata-rata harga sekian hari. Klasiknya 200 hari (±10 bulan bursa). Makin besar makin kalem & jarang transaksi. Pakai rentang waktu 2–5 tahun biar garisnya sempat terbentuk." defaultValue={200} hidden={!isTrend} />
          <Field name="cash" label="Modal awal ($)" tip="Uang awal yang dipakai untuk simulasi. Contoh: 10000 = $10.000." defaultValue={10000} />
          <FeeField />
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

// Real Gotrade trading fees (all-in, inclusive of PPN), as a fraction per trade.
// Source: heygotrade.com/id/fee — Reguler 0,3%, Prestige 0,2%.
// ponytail: flat fraction only; Gotrade's $0.10 min/trade isn't modeled (negligible
// at normal sizing). Add per-trade min only if someone backtests tiny positions.
const FEE_OPTIONS = [
  { mode: "default", label: "Default — 0,2%", value: 0.002 },
  { mode: "gotrade_regular", label: "Gotrade Reguler — 0,3%", value: 0.003 },
  { mode: "gotrade_prestige", label: "Gotrade Prestige — 0,2%", value: 0.002 },
  { mode: "custom", label: "Atur sendiri", value: null },
] as const;

// Biaya per transaksi: pick a preset (app default or a real Gotrade tier) or
// type your own. Renders a number input named "commission" so the form reads it
// the same as the other fields.
function FeeField() {
  const [mode, setMode] = useState<(typeof FEE_OPTIONS)[number]["mode"]>("default");
  const [value, setValue] = useState(0.002);

  function pick(next: typeof mode) {
    setMode(next);
    const preset = FEE_OPTIONS.find((o) => o.mode === next)!.value;
    if (preset != null) setValue(preset);
  }

  return (
    <label className="field">
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        Biaya per transaksi{" "}
        <InfoTip text="Potongan biaya tiap beli/jual, sebagai pecahan: 0,002 = 0,2%. Pilih biaya Gotrade (Reguler 0,3% / Prestige 0,2%, sudah termasuk PPN) atau atur sendiri." />
      </span>
      <select value={mode} onChange={(e) => pick(e.target.value as typeof mode)}>
        {FEE_OPTIONS.map((o) => (
          <option key={o.mode} value={o.mode}>{o.label}</option>
        ))}
      </select>
      {/* Only shown for "Atur sendiri"; stays in the DOM (display:none) when a
          preset is picked so the form still submits commission, and the column
          lines up with the single-input fields next to it. */}
      <input
        name="commission"
        type="number"
        step={0.001}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        style={{ display: mode === "custom" ? undefined : "none" }}
      />
    </label>
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
