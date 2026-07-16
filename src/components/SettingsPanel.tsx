// Layar "Sumber Data" (BYOK). Per fitur (harga/fundamental/kepemilikan) user
// memilih Default (gratis, tertunda) atau Custom dengan API key sendiri, plus
// toggle Hemat Data vs Real-time. Tersimpan di localStorage (src/settings.ts);
// key hanya di mesin user, diteruskan ke backend lewat header per request.
import { useState } from "react";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Feature,
  type Settings,
} from "../settings";
import { InfoTip } from "./ui";

// Provider yang tersedia per fitur. "default" selalu ada (gratis). Provider
// eksternal aktif hanya bila key-nya diisi (adapter backend menyusul di task 018).
// Fundamental dipisah US & IDX: sumbernya beda, dan user bisa punya key untuk
// keduanya sekaligus (FMP untuk saham US, Sectors.app untuk saham IDX). App
// memilih otomatis sesuai kode saham yang dibuka.
const PROVIDERS: Record<Feature, { value: string; label: string; keyName?: string }[]> = {
  prices: [
    { value: "default", label: "Default — Yahoo (gratis, ±15 menit tertunda)" },
    { value: "finnhub", label: "Finnhub (real-time US, key sendiri)", keyName: "finnhub" },
    { value: "twelvedata", label: "Twelve Data (bar tertunda, key sendiri)", keyName: "twelvedata" },
  ],
  fundamentals_us: [
    { value: "default", label: "Default — Yahoo (gratis)" },
    { value: "fmp", label: "Financial Modeling Prep (key sendiri)", keyName: "fmp" },
  ],
  fundamentals_id: [
    { value: "default", label: "Default — Yahoo (gratis)" },
    { value: "sectors", label: "Sectors.app (key sendiri)", keyName: "sectors" },
  ],
  ownership: [
    { value: "default", label: "Default — KSEI (gratis, IDX)" },
    { value: "sectors", label: "Sectors.app (IDX, key sendiri)", keyName: "sectors" },
  ],
};

const FEATURE_LABEL: Record<Feature, string> = {
  prices: "Harga & grafik",
  fundamentals_us: "Fundamental — saham US",
  fundamentals_id: "Fundamental — saham Indonesia (IDX)",
  ownership: "Kepemilikan (IDX)",
};

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<Settings>(loadSettings);

  function commit(next: Settings) {
    setS(next);
    saveSettings(next);
  }

  function setProvider(feat: Feature, value: string) {
    commit({ ...s, providers: { ...s.providers, [feat]: value } });
  }
  function setKey(name: string, value: string) {
    commit({ ...s, keys: { ...s.keys, [name]: value } });
  }

  // Key inputs to show: one per external provider currently selected in any feature.
  const activeKeyNames = new Set<string>();
  for (const feat of Object.keys(PROVIDERS) as Feature[]) {
    const chosen = PROVIDERS[feat].find((p) => p.value === s.providers[feat]);
    if (chosen?.keyName) activeKeyNames.add(chosen.keyName);
  }

  return (
    <div className="settings">
      <div className="fund-list" style={{ marginBottom: 14 }}>
        <label className="pattern" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>
            <b>Mode data</b>
            <InfoTip text="Hemat Data pakai sumber gratis yang tertunda. Real-time butuh API key milikmu sendiri (mis. Finnhub) — masukkan di bawah." />
          </span>
          <span className="rrg-tf">
            <button type="button" className={s.mode === "hemat" ? "active" : ""} onClick={() => commit({ ...s, mode: "hemat" })}>
              Hemat Data
            </button>
            <button type="button" className={s.mode === "realtime" ? "active" : ""} onClick={() => commit({ ...s, mode: "realtime" })}>
              Real-time
            </button>
          </span>
        </label>
      </div>

      {(Object.keys(PROVIDERS) as Feature[]).map((feat) => (
        <div key={feat} style={{ marginBottom: 12 }}>
          <h4 style={{ margin: "0 0 4px", fontSize: 13.5 }}>{FEATURE_LABEL[feat]}</h4>
          <select
            value={s.providers[feat]}
            onChange={(e) => setProvider(feat, e.target.value)}
            aria-label={`Sumber ${FEATURE_LABEL[feat]}`}
            style={{ width: "100%" }}
          >
            {PROVIDERS[feat].map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      ))}

      {activeKeyNames.size > 0 && (
        <div style={{ marginTop: 8 }}>
          <h4 style={{ margin: "0 0 6px", fontSize: 13.5 }}>API Key (tersimpan lokal saja)</h4>
          {[...activeKeyNames].map((name) => (
            <div key={name} style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12.5, display: "block", marginBottom: 3, textTransform: "capitalize" }}>{name}</label>
              <input
                type="password"
                value={s.keys[name] || ""}
                onChange={(e) => setKey(name, e.target.value)}
                placeholder={`Tempel API key ${name} di sini`}
                autoComplete="off"
                style={{ width: "100%" }}
              />
            </div>
          ))}
          <p className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
            🔒 Key hanya disimpan di browser/mesin ini dan dikirim langsung ke sumber datanya. Tidak pernah masuk log.
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" className="btn-ghost btn-sm" onClick={() => commit({ ...DEFAULT_SETTINGS })}>
          Reset ke Default
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={onClose}>Selesai</button>
      </div>
    </div>
  );
}
