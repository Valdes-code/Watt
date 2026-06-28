import React from "react";
import { Sun, Moon, SunMoon, Sunrise, Sunset, MapPin } from "lucide-react";

const OPTIONS = [
  { key: "light", label: "Svetlý", Icon: Sun },
  { key: "dark", label: "Tmavý", Icon: Moon },
  { key: "auto", label: "Auto", Icon: SunMoon },
];

// Profil jazdca / bicykla (presunuté z mockupu „Appka").
const PROFILE_ROWS = [
  { l: "Hmotnosť jazdca", v: "75 kg" },
  { l: "Hmotnosť bicykla", v: "8.5 kg" },
  { l: "Výška", v: "180 cm" },
  { l: "Poloha tela", v: "Základná" },
  { l: "Pneumatiky", v: "Cestný tréningový" },
  { l: "Šírka / tlak", v: "28 mm / 6 bar" },
  { l: "Tubeless", v: "Áno" },
  { l: "Pokojový / max tep", v: "60 / 190 bpm" },
];

const fmtTime = (d) =>
  d ? d.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" }) : "—";

export default function Settings({ theme }) {
  const { mode, effective, sun, coords, geo, change } = theme;

  const geoLabel = {
    idle: "—",
    locating: "zisťuje sa…",
    ok: coords ? `${coords.lat.toFixed(3)}, ${coords.lon.toFixed(3)}` : "—",
    denied: "zamietnutá – riadi sa systémom",
    unavailable: "nedostupná – riadi sa systémom",
  }[geo];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, var(--bg-grad-1), var(--bg-grad-2) 55%)", padding: 22, fontFamily: "'Inter',sans-serif", display: "flex", justifyContent: "center" }}>
      <div style={{ width: 400, maxWidth: "100%" }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: "var(--text)" }}>Profil</div>
        <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 6, marginBottom: 20, lineHeight: 1.5 }}>
          Profil jazdca a nastavenia aplikácie.
        </div>

        {/* Profil jazdca / bicykla */}
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-2)", letterSpacing: 0.5, marginBottom: 10 }}>PROFIL JAZDCA</div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", marginBottom: 12 }}>
          {PROFILE_ROWS.map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", borderBottom: i < PROFILE_ROWS.length - 1 ? "1px solid var(--border)" : "none" }}>
              <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{r.l}</span>
              <span style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 600 }}>{r.v}</span>
            </div>
          ))}
        </div>
        <button style={{ width: "100%", background: "#ffd54a", border: "none", borderRadius: 12, padding: 13, marginBottom: 22, cursor: "pointer", fontSize: 13.5, fontWeight: 800, color: "#0d1320" }}>
          Upraviť profil
        </button>

        {/* Zobrazenie – téma */}
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-2)", letterSpacing: 0.5, marginBottom: 10 }}>ZOBRAZENIE</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {OPTIONS.map(({ key, label, Icon }) => {
            const on = mode === key;
            return (
              <button key={key} onClick={() => change(key)} style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                padding: "14px 6px", borderRadius: 12, cursor: "pointer", fontSize: 12, fontWeight: 700,
                border: on ? "1px solid #ffd54a" : "1px solid var(--border)",
                background: on ? "rgba(255,213,74,0.12)" : "var(--surface)",
                color: on ? "#ffd54a" : "var(--text-2)",
              }}>
                <Icon size={20} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Stav auto režimu */}
        {mode === "auto" && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.7 }}>
              <Row icon={MapPin} label="Poloha" value={geoLabel} />
              <Row icon={Sunrise} label="Východ slnka" value={fmtTime(sun?.sunrise)} />
              <Row icon={Sunset} label="Západ slnka" value={fmtTime(sun?.sunset)} />
            </div>
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-2)" }}>
              Aktuálne:{" "}
              <span style={{ fontWeight: 800, color: effective === "light" ? "#ffd54a" : "#7fb0ff" }}>
                {effective === "light" ? "svetlý" : "tmavý"}
              </span>{" "}
              režim · po západe slnka sa prepne automaticky.
            </div>
          </div>
        )}
        {mode !== "auto" && (
          <div style={{ fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.5 }}>
            „Auto" prepína svetlý/tmavý podľa západu slnka v tvojej polohe (čas berie zo zariadenia).
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Icon size={14} color="var(--text-3)" />
      <span style={{ color: "var(--text-3)" }}>{label}:</span>
      <span style={{ marginLeft: "auto", fontWeight: 700, color: "var(--text)" }}>{value}</span>
    </div>
  );
}
