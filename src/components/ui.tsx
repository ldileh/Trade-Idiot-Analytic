// Small presentational building blocks shared across the app: a hover/focus
// tooltip for plain-language help, a card wrapper, and a numbered step header.
import type { ReactNode } from "react";

// A "?" dot that reveals a plain explanation on hover or keyboard focus.
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="tip">
      <button type="button" className="tip-dot" aria-label="Penjelasan" tabIndex={0}>
        ?
      </button>
      <span role="tooltip" className="tip-body">
        {text}
      </span>
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={`card${className ? ` ${className}` : ""}`}>{children}</section>;
}

// Numbered "Langkah N" header with an optional subtitle line.
export function SectionHead({
  step,
  title,
  subtitle,
}: {
  step: number | string;
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <>
      <div className="section-head">
        <span className="step-badge">{step}</span>
        <h2>{title}</h2>
      </div>
      {subtitle && <p className="section-sub">{subtitle}</p>}
    </>
  );
}
