// Modal "Dasar Ilmiah": setiap metode yang dipakai app ini, apa temuan risetnya,
// dan seberapa kuat dukungannya. Isinya datang dari src/references.ts — satu
// sumber, jadi katalog tidak bisa diam-diam melenceng dari yang diimplementasi.
import { useMemo, useState } from "react";
import {
  EVIDENCE_META,
  REFERENCE_GROUPS,
  evidenceCounts,
  type Evidence,
  type MethodRef,
} from "../references";
import { InfoTip } from "./ui";

const EVIDENCE_ORDER: Evidence[] = ["peer_reviewed", "established", "mixed", "heuristic"];

const INTRO =
  "App ini memakai metode yang berasal dari berbagai tingkat bukti — dari paper Journal of Finance " +
  "sampai aturan praktis buatan sendiri. Semuanya dicantumkan apa adanya, termasuk yang bukti " +
  "risetnya justru LEMAH, supaya kamu bisa menimbang sendiri seberapa jauh setiap angka layak dipercaya.";

function MethodCard({ m }: { m: MethodRef }) {
  const ev = EVIDENCE_META[m.evidence];
  return (
    <div className={`ref-card ev-${m.evidence}`}>
      <div className="ref-card-head">
        <span className="ref-title">
          {m.emoji} {m.title}
        </span>
        <span className={`ref-badge ev-${m.evidence}`} title={ev.blurb}>
          {ev.emoji} {ev.label}
        </span>
      </div>

      <div className="ref-tech">
        {m.technical} · <span className="ref-where">{m.where}</span>
      </div>

      <div className="ref-what">{m.what}</div>

      <div className="ref-finding">
        <span className="ref-finding-k">Dasar / temuan riset</span>
        {m.finding}
      </div>

      {m.caveat && <div className="ref-caveat">⚠️ {m.caveat}</div>}

      <ul className="ref-cites">
        {m.citations.map((c, i) => (
          <li key={i}>
            {c.url ? (
              <a href={c.url} target="_blank" rel="noreferrer">
                {c.text} ↗
              </a>
            ) : (
              c.text
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ReferencesPanel() {
  const [filter, setFilter] = useState<Evidence | "all">("all");
  const [q, setQ] = useState("");
  const counts = useMemo(evidenceCounts, []);

  // Cari di semua teks yang terlihat user, termasuk isi sitasi — supaya
  // mengetik "Piotroski" atau "Journal of Finance" sama-sama menemukan.
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return REFERENCE_GROUPS.map((g) => ({
      ...g,
      methods: g.methods.filter((m) => {
        if (filter !== "all" && m.evidence !== filter) return false;
        if (!needle) return true;
        const hay = [m.title, m.technical, m.what, m.finding, m.caveat ?? "", m.where]
          .concat(m.citations.map((c) => c.text))
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      }),
    })).filter((g) => g.methods.length > 0);
  }, [filter, q]);

  const total = REFERENCE_GROUPS.reduce((n, g) => n + g.methods.length, 0);
  const shown = groups.reduce((n, g) => n + g.methods.length, 0);

  return (
    <div>
      <p className="p-sum" style={{ marginTop: 0 }}>{INTRO}</p>

      {/* Ringkasan tingkat bukti; klik untuk memfilter. */}
      <div className="ref-legend">
        <button
          type="button"
          className={`ref-chip${filter === "all" ? " active" : ""}`}
          onClick={() => setFilter("all")}
        >
          Semua <span className="count">{total}</span>
        </button>
        {EVIDENCE_ORDER.map((e) => (
          <button
            key={e}
            type="button"
            className={`ref-chip ev-${e}${filter === e ? " active" : ""}`}
            onClick={() => setFilter(filter === e ? "all" : e)}
            title={EVIDENCE_META[e].blurb}
          >
            {EVIDENCE_META[e].emoji} {EVIDENCE_META[e].label} <span className="count">{counts[e]}</span>
          </button>
        ))}
        <InfoTip text="Tingkat bukti dibedakan supaya paper akademik tidak tampak setara dengan konvensi praktisi atau aturan buatan app ini sendiri. Klik untuk menyaring." />
      </div>

      {filter !== "all" && <div className="ref-legend-note">{EVIDENCE_META[filter].blurb}</div>}

      <label className="field" style={{ marginTop: 10 }}>
        <span>Cari metode, istilah, atau nama peneliti</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="mis. ATR, Piotroski, momentum, Journal of Finance"
          aria-label="Cari referensi"
        />
      </label>

      {shown === 0 ? (
        <p className="muted" style={{ marginTop: 14 }}>
          Tidak ada metode yang cocok dengan pencarian itu.
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.id} style={{ marginTop: 18 }}>
            <div className="ref-group-head">
              <span className="ref-group-title">
                {g.emoji} {g.title}
              </span>
              <span className="muted" style={{ fontSize: 12 }}>
                {g.methods.length} metode
              </span>
            </div>
            <p className="p-sum" style={{ marginTop: 2 }}>{g.intro}</p>
            <div className="ref-list">
              {g.methods.map((m) => (
                <MethodCard key={m.id} m={m} />
              ))}
            </div>
          </section>
        ))
      )}

      <p className="muted" style={{ fontSize: 12, marginTop: 18, lineHeight: 1.55 }}>
        Adanya rujukan ilmiah <b>tidak</b> membuat sebuah angka jadi ramalan. Temuan riset berlaku
        secara rata-rata pada banyak saham dan periode panjang — bukan jaminan untuk satu saham yang
        sedang kamu lihat. Semua isi app ini bahan bantu belajar, <b>BUKAN ajakan jual/beli</b>.
      </p>
    </div>
  );
}
