import React, { useState } from "react";
import { Sun, Moon, SunMoon, Sunrise, Sunset, MapPin, Bike, Plus, Trash2, Pencil, Check } from "lucide-react";
import SensorsPanel from "./SensorsPanel.jsx";
import { loadHistoryMax, saveHistoryMax } from "../lib/history.js";
import { saveUser, newBikeId } from "../lib/user.js";

// Presety veľkosti histórie jázd (počet uchovaných trás).
const HSIZES = [5, 8, 15, 25, 50];

const OPTIONS = [
  { key: "light", label: "Svetlý", Icon: Sun },
  { key: "dark", label: "Tmavý", Icon: Moon },
  { key: "auto", label: "Auto", Icon: SunMoon },
];

const fmtTime = (d) =>
  d ? d.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" }) : "—";

const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 10,
  border: "1px solid var(--border-2)", background: "var(--surface-2)", color: "var(--text)",
  fontSize: 13, fontFamily: "inherit", outline: "none",
};

export default function Settings({ theme, user, onUserChange }) {
  const { mode, effective, sun, coords, geo, change } = theme;
  const [histMax, setHistMax] = useState(loadHistoryMax);
  const [editing, setEditing] = useState(false);

  // Zápis zmien profilu (okamžite do localStorage + do stavu appky).
  const persist = (patch) => onUserChange?.(saveUser({ ...user, ...patch }));
  const updateBike = (id, patch) => persist({ bikes: user.bikes.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  const addBike = () => {
    const b = { id: newBikeId(), name: `Bicykel ${user.bikes.length + 1}`, weightKg: 8.5 };
    persist({ bikes: [...user.bikes, b], activeBikeId: b.id });
  };
  const removeBike = (id) => {
    if (user.bikes.length <= 1) return;
    const bikes = user.bikes.filter((b) => b.id !== id);
    persist({ bikes, activeBikeId: user.activeBikeId === id ? bikes[0].id : user.activeBikeId });
  };
  const setActive = (id) => persist({ activeBikeId: id });

  const RIDER_ROWS = [
    { l: "Prezývka", v: user?.nick || "—" },
    { l: "E-mail", v: user?.email || "—" },
    { l: "Hmotnosť jazdca", v: `${user?.riderKg ?? 75} kg` },
    { l: "Výška", v: `${user?.heightCm ?? 180} cm` },
  ];

  const geoLabel = {
    idle: "—",
    locating: "zisťuje sa…",
    ok: coords ? `${coords.lat.toFixed(3)}, ${coords.lon.toFixed(3)}` : "—",
    denied: "zamietnutá – riadi sa systémom",
    unavailable: "nedostupná – riadi sa systémom",
  }[geo];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, var(--bg-grad-1), var(--bg-grad-2) 55%)", padding: 22, fontFamily: "'Inter',sans-serif", display: "flex", justifyContent: "center" }}>
      <div style={{ width: 400, maxWidth: "100%", minWidth: 0 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: "var(--text)" }}>Profil</div>
        <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 6, marginBottom: 20, lineHeight: 1.5 }}>
          Profil jazdca a nastavenia aplikácie.
        </div>

        {/* Profil jazdca */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-2)", letterSpacing: 0.5 }}>PROFIL JAZDCA</div>
          <button onClick={() => setEditing((e) => !e)} style={{
            marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer",
            background: editing ? "#ffd54a" : "var(--surface)", border: editing ? "none" : "1px solid var(--border)",
            borderRadius: 9, padding: "5px 11px", fontSize: 11.5, fontWeight: 700, color: editing ? "#0d1320" : "var(--text-1)",
          }}>
            {editing ? <><Check size={13} /> Hotovo</> : <><Pencil size={12} /> Upraviť</>}
          </button>
        </div>

        {editing ? (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 14, marginBottom: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Prezývka">
              <input style={inputStyle} defaultValue={user.nick || ""} onBlur={(e) => persist({ nick: e.target.value.trim() || user.nick })} />
            </Field>
            <Field label="E-mail">
              <input style={inputStyle} type="email" defaultValue={user.email || ""} onBlur={(e) => persist({ email: e.target.value.trim() || null })} />
            </Field>
            <Field label="Hmotnosť jazdca (kg)">
              <input style={inputStyle} type="number" inputMode="decimal" defaultValue={user.riderKg ?? 75} onBlur={(e) => persist({ riderKg: Number(e.target.value) || user.riderKg })} />
            </Field>
            <Field label="Výška (cm)">
              <input style={inputStyle} type="number" inputMode="numeric" defaultValue={user.heightCm ?? 180} onBlur={(e) => persist({ heightCm: Number(e.target.value) || user.heightCm })} />
            </Field>
          </div>
        ) : (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", marginBottom: 12 }}>
            {RIDER_ROWS.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderBottom: i < RIDER_ROWS.length - 1 ? "1px solid var(--border)" : "none" }}>
                <span style={{ fontSize: 12.5, color: "var(--text-2)", flexShrink: 0 }}>{r.l}</span>
                <span style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>{r.v}</span>
              </div>
            ))}
          </div>
        )}

        {user?.uid && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px", marginBottom: 22 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)" }}>ID účtu</span>
            <span title="Jedinečné ID – nedá sa meniť" style={{ marginLeft: "auto", fontSize: 11, fontFamily: "monospace", color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 210 }}>{user.uid}</span>
          </div>
        )}

        {/* Bicykle – výber aktívneho + správa */}
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-2)", letterSpacing: 0.5, marginBottom: 10 }}>BICYKLE</div>
        {user?.bikes?.map((b) => {
          const on = b.id === user.activeBikeId;
          return (
            <div key={b.id} onClick={() => setActive(b.id)} title={on ? "Aktívny bicykel" : "Zvoliť ako aktívny"} style={{
              display: "flex", alignItems: "center", gap: 11, cursor: "pointer", marginBottom: 9,
              background: on ? "rgba(255,213,74,0.08)" : "var(--surface)",
              border: on ? "1px solid #ffd54a" : "1px solid var(--border)", borderRadius: 12, padding: 12,
            }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: on ? "rgba(255,213,74,0.15)" : "var(--surface-3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Bike size={17} color={on ? "#ffd54a" : "var(--text-3)"} />
              </div>
              {editing ? (
                <div style={{ display: "flex", gap: 8, flex: 1, minWidth: 0 }} onClick={(e) => e.stopPropagation()}>
                  <input style={{ ...inputStyle, flex: 1 }} defaultValue={b.name} onBlur={(e) => updateBike(b.id, { name: e.target.value.trim() || b.name })} />
                  <input style={{ ...inputStyle, width: 78 }} type="number" inputMode="decimal" defaultValue={b.weightKg} onBlur={(e) => updateBike(b.id, { weightKg: Number(e.target.value) || b.weightKg })} />
                </div>
              ) : (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>{b.weightKg} kg</div>
                </div>
              )}
              {on && !editing && (
                <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.4, color: effective === "light" ? "#8a6a00" : "#ffd54a", background: "rgba(255,213,74,0.15)", borderRadius: 6, padding: "2px 6px", flexShrink: 0 }}>AKTÍVNY</span>
              )}
              {editing && user.bikes.length > 1 && (
                <button onClick={(e) => { e.stopPropagation(); removeBike(b.id); }} title="Odstrániť bicykel" style={{ background: "transparent", border: "none", color: "#ff5470", cursor: "pointer", padding: 4, display: "flex", flexShrink: 0 }}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          );
        })}
        {editing && (
          <button onClick={addBike} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            background: "var(--surface)", border: "1px dashed var(--border-2)", borderRadius: 12, padding: 11,
            cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "var(--text-1)", marginBottom: 22,
          }}>
            <Plus size={15} /> Pridať bicykel
          </button>
        )}
        {!editing && <div style={{ marginBottom: 22 }} />}

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

        {/* História jázd – veľkosť zoznamu */}
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-2)", letterSpacing: 0.5, marginTop: 26, marginBottom: 10 }}>HISTÓRIA JÁZD</div>
        <div style={{ fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.5, marginBottom: 10 }}>
          Koľko posledných trás sa uchová v zozname. Ukladá sa v zariadení.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {HSIZES.map((n) => {
            const on = histMax === n;
            return (
              <button key={n} onClick={() => setHistMax(saveHistoryMax(n))} style={{
                flex: 1, padding: "12px 6px", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 800,
                border: on ? "1px solid #ffd54a" : "1px solid var(--border)",
                background: on ? "rgba(255,213,74,0.12)" : "var(--surface)",
                color: on ? "#ffd54a" : "var(--text-2)",
              }}>{n}</button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-4)", marginTop: 8, lineHeight: 1.5 }}>
          Pri znížení sa najstaršie trasy nad limit odstránia. Veľa trás zaberá viac miesta v zariadení.
        </div>

        {/* Pripojené snímače (presunuté z mockupu „Appka") */}
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-2)", letterSpacing: 0.5, marginTop: 26, marginBottom: 10 }}>PRIPOJENÉ SNÍMAČE</div>
        <SensorsPanel />
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

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-2)", marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}
