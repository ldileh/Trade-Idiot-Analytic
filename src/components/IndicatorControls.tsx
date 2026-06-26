import type { IndicatorKind, IndicatorSpec } from "../types";
import { INDICATOR_KINDS, specKey } from "../indicators";

// Add/remove indicators without reloading. Parent owns the active list; this
// component is a thin controlled form over it.
export default function IndicatorControls({
  active,
  onAdd,
  onRemove,
}: {
  active: IndicatorSpec[];
  onAdd: (spec: IndicatorSpec) => void;
  onRemove: (spec: IndicatorSpec) => void;
}) {
  return (
    <div style={{ marginTop: "1rem" }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const kind = (form.elements.namedItem("kind") as HTMLSelectElement).value as IndicatorKind;
          const period = Number((form.elements.namedItem("period") as HTMLInputElement).value);
          if (!Number.isFinite(period) || period < 1) return;
          onAdd({ kind, period });
        }}
        style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
      >
        <select name="kind" defaultValue="ema" aria-label="Jenis indikator">
          {INDICATOR_KINDS.map((k) => (
            <option key={k} value={k}>{k.toUpperCase()}</option>
          ))}
        </select>
        <input
          name="period"
          type="number"
          min={1}
          max={500}
          defaultValue={20}
          aria-label="Period"
          style={{ width: "5rem" }}
        />
        <button type="submit">+ Indikator</button>
      </form>

      {active.length > 0 && (
        <ul style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", listStyle: "none", padding: 0, marginTop: "0.75rem" }}>
          {active.map((spec) => (
            <li
              key={specKey(spec)}
              style={{ display: "flex", gap: "0.35rem", alignItems: "center", border: "1px solid #ccc", borderRadius: "1rem", padding: "0.15rem 0.6rem" }}
            >
              <span>{spec.kind.toUpperCase()}{spec.period}</span>
              <button
                type="button"
                onClick={() => onRemove(spec)}
                aria-label={`Hapus ${spec.kind}${spec.period}`}
                style={{ border: "none", background: "none", cursor: "pointer", fontSize: "1rem", lineHeight: 1 }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
