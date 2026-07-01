import React, { useMemo } from "react";
import { Activity, TrendingUp, Battery, Gauge } from "lucide-react";
import { loadHistory } from "../lib/history.js";
import { analyzeTraining } from "../lib/training.js";

// Záložka „Tréningový stav" – z histórie jázd odvodí kondíciu/únavu/formu a stav.
export default function TrainingStatus({ user }) {
  const data = useMemo(() => analyzeTraining(loadHistory(), user, new Date()), [user]);
  const { ctl, atl, tsb, ramp, status, ftp, rides, days, dailyTss } = data;

  // Týždenná záťaž za posledných 6 týždňov (súčet TSS po týždňoch).
  const weeks = useMemo(() => {
    const out = [];
    for (let end = dailyTss.length; end > 0 && out.length < 6; end -= 7) {
      const seg = dailyTss.slice(Math.max(0, end - 7), end);
      out.unshift(Math.round(seg.reduce((s, v) => s + v, 0)));
    }
    return out;
  }, [dailyTss]);
  const maxWeek = Math.max(1, ...weeks);

  const analyzed = rides.length;
  const dated = rides.filter((r) => r.tss > 0).length;

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 50% 0%, var(--bg-grad-1), var(--bg-grad-2) 60%)", padding: 22, fontFamily: "'Inter',sans-serif", display: "flex", justifyContent: "center" }}>
      <div style={{ width: 400, maxWidth: "100%", minWidth: 0 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: "var(--text)" }}>Tréningový stav</div>
        <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 6, marginBottom: 20, lineHeight: 1.5 }}>
          Z histórie jázd odhadneme kondíciu, únavu a formu. FTP: <b style={{ color: "var(--text-1)" }}>{ftp} W</b> (uprav v Profile).
        </div>

        {/* Stav */}
        <div style={{ background: "var(--surface)", border: `1px solid ${status.color}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--surface-3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Activity size={20} color={status.color} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-3)", letterSpacing: 0.5 }}>AKTUÁLNY STAV</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: status.color }}>{status.label}</div>
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.5 }}>{status.desc}</div>
        </div>

        {/* Metriky */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <Metric icon={Gauge} label="Kondícia" hint="CTL · 42 dní" value={Math.round(ctl)} color="#4ade80" />
          <Metric icon={Battery} label="Únava" hint="ATL · 7 dní" value={Math.round(atl)} color="#ff8a3d" />
          <Metric icon={TrendingUp} label="Forma" hint="TSB" value={(tsb >= 0 ? "+" : "") + Math.round(tsb)} color="#7fb0ff" />
        </div>

        {/* Trend kondície za týždeň */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "var(--text-2)" }}>
          Kondícia za posledný týždeň:{" "}
          <b style={{ color: ramp >= 0 ? "#4ade80" : "#ff8a3d" }}>{ramp >= 0 ? "+" : ""}{Math.round(ramp)}</b>
          {" "}{ramp >= 0 ? "▲ rastie" : "▼ klesá"}
        </div>

        {/* Týždenná záťaž */}
        {weeks.length > 0 && (
          <>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-2)", letterSpacing: 0.5, marginBottom: 10 }}>TÝŽDENNÁ ZÁŤAŽ (TSS)</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 96, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 12 }}>
              {weeks.map((w, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, height: "100%", justifyContent: "flex-end" }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-2)" }}>{w}</div>
                  <div style={{ width: "100%", height: `${Math.max(4, (w / maxWeek) * 100)}%`, background: i === weeks.length - 1 ? "#ffd54a" : "var(--border-2)", borderRadius: 6 }} />
                  <div style={{ fontSize: 9, color: "var(--text-4)" }}>{i === weeks.length - 1 ? "teraz" : `-${weeks.length - 1 - i}t`}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ fontSize: 10.5, color: "var(--text-4)", marginTop: 14, lineHeight: 1.6 }}>
          {analyzed === 0
            ? "Zatiaľ žiadne jazdy v histórii. Naimportuj jazdy v Analýze jazdy."
            : `Analyzovaných ${analyzed} jázd (${dated} so záťažou). Výkon je odhad z fyziky, ak jazda nemá merač; TSS je preto orientačný. Dátum jazdy berieme z GPX (inak z importu).`}
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, hint, value, color }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
        <Icon size={13} color={color} />
        <span style={{ fontSize: 10, color: "var(--text-2)", fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)" }}>{value}</div>
      <div style={{ fontSize: 9, color: "var(--text-4)" }}>{hint}</div>
    </div>
  );
}
