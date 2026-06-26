import { useState } from "react";
import { postBacktest } from "../api/client";
import type { BacktestRequest, BacktestResponse, Interval, Range, Strategy } from "../types";
import EquityChart from "./EquityChart";

const STRATEGIES: Strategy[] = ["sma_cross", "rsi_reversion"];

// Shared market context comes from the chart panel above so backtest runs on the
// same ticker/timeframe the user is looking at.
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
    // All param fields always render (inactive ones hidden), so every value posts.
    const body: BacktestRequest = {
      ticker,
      interval,
      range,
      strategy,
      fast: num("fast"),
      slow: num("slow"),
      rsi_period: num("rsi_period"),
      rsi_lower: num("rsi_lower"),
      rsi_upper: num("rsi_upper"),
      cash: num("cash"),
      commission: num("commission"),
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
    <section style={{ marginTop: "2rem", borderTop: "1px solid #eee", paddingTop: "1.5rem" }}>
      <h2 style={{ marginBottom: "0.75rem" }}>Backtest</h2>

      <form onSubmit={run} style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(7rem, 1fr))", alignItems: "end" }}>
        <label>
          Strategi
          <select value={strategy} onChange={(e) => setStrategy(e.target.value as Strategy)} style={{ width: "100%" }}>
            {STRATEGIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <Field name="fast" label="Fast" defaultValue={10} hidden={!isSma} />
        <Field name="slow" label="Slow" defaultValue={30} hidden={!isSma} />
        <Field name="rsi_period" label="RSI period" defaultValue={14} hidden={isSma} />
        <Field name="rsi_lower" label="RSI lower" defaultValue={30} hidden={isSma} />
        <Field name="rsi_upper" label="RSI upper" defaultValue={70} hidden={isSma} />
        <Field name="cash" label="Cash" defaultValue={10000} />
        <Field name="commission" label="Commission" defaultValue={0.002} step={0.001} />

        <button type="submit" disabled={loading} style={{ height: "2rem" }}>
          {loading ? "Running…" : "Run backtest"}
        </button>
      </form>

      {error && (
        <p role="alert" style={{ color: "#b00020", marginTop: "1rem" }}>
          {error}
        </p>
      )}

      {result && (
        <>
          <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))", marginTop: "1rem" }}>
            {Object.entries(result.stats).map(([k, v]) => (
              <div key={k} style={{ border: "1px solid #eee", borderRadius: "0.5rem", padding: "0.5rem 0.75rem" }}>
                <div style={{ fontSize: "0.75rem", color: "#666" }}>{k}</div>
                <div style={{ fontWeight: 600 }}>{v ?? "—"}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "1rem" }}>
            <EquityChart points={result.equity_curve} />
          </div>
        </>
      )}
    </section>
  );
}

// Hidden fields stay in the form (and in form.elements) so every strategy's
// params post, but only the active strategy's fields are visible.
function Field({
  name,
  label,
  defaultValue,
  step,
  hidden,
}: {
  name: string;
  label: string;
  defaultValue: number;
  step?: number;
  hidden?: boolean;
}) {
  return (
    <label style={{ display: hidden ? "none" : undefined }}>
      {label}
      <input name={name} type="number" defaultValue={defaultValue} step={step} style={{ width: "100%" }} />
    </label>
  );
}
