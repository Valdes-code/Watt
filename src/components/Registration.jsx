import React, { useState } from "react";
import { User, Check } from "lucide-react";
import { createUser } from "../lib/user.js";

// Registračný formulár pri prvom spustení appky. Po vyplnení vytvorí lokálny
// profil s jedinečným UID a odovzdá ho cez onDone.
const FIELDS = [
  { key: "nick", label: "Prezývka", type: "text", placeholder: "napr. Janko", required: true },
  { key: "email", label: "E-mail (nepovinné)", type: "email", placeholder: "pre budúce prepojenie účtu" },
  { key: "riderKg", label: "Hmotnosť jazdca (kg)", type: "number", placeholder: "75", required: true },
  { key: "bikeKg", label: "Hmotnosť bicykla (kg)", type: "number", placeholder: "8.5" },
  { key: "heightCm", label: "Výška (cm)", type: "number", placeholder: "180" },
];

export default function Registration({ onDone }) {
  const [form, setForm] = useState({ nick: "", email: "", riderKg: "", bikeKg: "", heightCm: "" });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const valid = form.nick.trim().length > 0 && Number(form.riderKg) > 0;

  const submit = () => {
    if (!valid) return;
    const user = createUser({
      nick: form.nick.trim(),
      email: form.email.trim() || null,
      riderKg: Number(form.riderKg) || 75,
      bikeKg: Number(form.bikeKg) || 8.5,
      heightCm: Number(form.heightCm) || 180,
    });
    onDone(user);
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, var(--bg-grad-1), var(--bg-grad-2) 55%)", padding: 22, fontFamily: "'Inter',sans-serif", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
      <div style={{ width: 400, maxWidth: "100%", marginTop: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,213,74,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <User size={20} color="#ffd54a" />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Vitaj v CycloWatt</div>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-2)", marginBottom: 22, lineHeight: 1.5 }}>
          Vyplň základné údaje. Vytvoríme ti profil s jedinečným ID – uloží sa v
          zariadení a neskôr poslúži na prepojenie účtu a zdieľanie s priateľmi.
        </div>

        {FIELDS.map(({ key, label, type, placeholder, required }) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-2)", marginBottom: 6 }}>
              {label}{required && <span style={{ color: "#ffd54a" }}> *</span>}
            </label>
            <input
              type={type}
              inputMode={type === "number" ? "decimal" : undefined}
              value={form[key]}
              placeholder={placeholder}
              onChange={(e) => set(key, e.target.value)}
              style={{
                width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 11,
                border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
                fontSize: 13.5, fontFamily: "inherit", outline: "none",
              }}
            />
          </div>
        ))}

        <button
          onClick={submit}
          disabled={!valid}
          style={{
            width: "100%", marginTop: 8, background: valid ? "#ffd54a" : "var(--surface-3)",
            border: "none", borderRadius: 12, padding: 14, cursor: valid ? "pointer" : "default",
            fontSize: 14, fontWeight: 800, color: valid ? "#0d1320" : "var(--text-4)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <Check size={16} /> Vytvoriť profil
        </button>
        <div style={{ fontSize: 10.5, color: "var(--text-4)", textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
          Údaje ostávajú v tvojom zariadení. Hmotnosť použijeme pri výpočte výkonu.
        </div>
      </div>
    </div>
  );
}
