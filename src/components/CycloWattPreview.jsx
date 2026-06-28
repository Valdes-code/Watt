import React, { useState, useEffect } from "react";
import {
  Heart, Wind, Gauge, TrendingUp, Activity, Cpu, Play, Pause,
} from "lucide-react";
// Zdieľaný fyzikálny engine (pozri src/lib/physics.js)
import { airDensity, estimateCdA, calcPower, physicsTrust, fuse, hrZone } from "../lib/physics.js";

const CFG = { rider: 75, bike: 8.5, height: 180, crr: 0.0052 };
const RIDE = [
  { dur: 7, slope: 0, speed: 30, wind: 1, label: "Rovina" },
  { dur: 9, slope: 6, speed: 16, wind: 3, label: "Stúpanie" },
  { dur: 6, slope: -7, speed: 46, wind: -2, label: "Zjazd" },
  { dur: 8, slope: 0, speed: 33, wind: 4, label: "Protivietor" },
];

function frame(t) {
  const total = RIDE.reduce((s, r) => s + r.dur, 0);
  const tt = t % total;
  let acc = 0, seg = RIDE[0];
  for (const r of RIDE) { if (tt < acc + r.dur) { seg = r; break; } acc += r.dur; }
  const noise = (a) => (Math.sin(t * 2.3) + Math.sin(t * 5.1)) * 0.5 * a;
  const speed = Math.max(3, seg.speed + noise(2)) / 3.6;
  const slope = seg.slope / 100;
  const wind = seg.wind / 3.6;
  const eHR = 60 + 130 * Math.min(1, (seg.slope > 0 ? 0.55 + seg.slope * 0.04 : 0.45) + noise(0.02));
  const cda = estimateCdA(CFG.height / 100, CFG.rider);
  const phys = calcPower({ speed, slope, totalMass: CFG.rider + CFG.bike, cda, crr: CFG.crr, rho: airDensity(), wind });
  const hrP = Math.max(0, Math.round(2.6 * eHR - 150));
  const trust = physicsTrust({ slope, speed });
  const f = fuse(phys, hrP, trust);
  return { seg, speed: speed * 3.6, slope: seg.slope, wind: seg.wind, hr: Math.round(eHR), ...f, zone: hrZone(eHR) };
}

const PHONE_W = 300;

export default function CycloWattPreview() {
  return (
    <div style={{
      minHeight: "100vh", background: "radial-gradient(circle at 50% 0%, var(--bg-grad-1), var(--surface-2) 60%)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      fontFamily: "'Inter',sans-serif",
    }}>
      <div style={{
        width: PHONE_W, height: 640, background: "var(--surface-2)", borderRadius: 38,
        border: "1px solid var(--border)", boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        overflow: "hidden", display: "flex", flexDirection: "column", position: "relative",
      }}>
        {/* status bar */}
        <div style={{ height: 32, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 6 }}>
          <div style={{ width: 90, height: 5, borderRadius: 3, background: "var(--border)" }} />
        </div>

        {/* content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <RideTab />
        </div>
      </div>
    </div>
  );
}

// ── RIDE TAB ─────────────────────────────────────────────────────
function RideTab() {
  const [running, setRunning] = useState(true);
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setT((p) => p + 0.25), 250);
    return () => clearInterval(id);
  }, [running]);
  const d = frame(t);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>Záznam jazdy</div>
          <div style={{ fontSize: 10.5, color: d.zone.color, fontWeight: 600 }}>{d.seg.label}</div>
        </div>
        <button onClick={() => setRunning((r) => !r)} style={{
          marginLeft: "auto", width: 34, height: 34, borderRadius: 10,
          border: "1px solid var(--border)", background: "var(--surface-3)", color: "#ffd54a",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}>{running ? <Pause size={16} /> : <Play size={16} />}</button>
      </div>

      {/* power hero */}
      <div style={{ background: "var(--surface-3)", border: "1px solid var(--border)", borderRadius: 20, padding: 18, marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: "var(--text-2)", fontWeight: 600, letterSpacing: 1 }}>VÝKON</div>
        <div style={{ fontSize: 52, fontWeight: 800, color: "var(--text)", lineHeight: 1.1, letterSpacing: -2 }}>
          {d.power}<span style={{ fontSize: 20, color: "#ffd54a" }}> W</span>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 14, background: "rgba(255,213,74,0.12)", fontSize: 10.5, fontWeight: 700, color: "#ffd54a", marginTop: 4 }}>
          <Cpu size={11} /> {d.source}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <Mini icon={Gauge} label="Rýchlosť" value={d.speed.toFixed(1)} unit="km/h" c="#7fb0ff" />
        <Mini icon={TrendingUp} label="Sklon" value={d.slope} unit="%" c="#ff8a3d" />
      </div>

      {/* wind */}
      <div style={{ display: "flex", alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 12, marginBottom: 8 }}>
        <Wind size={18} color={d.wind > 0 ? "#ff5470" : d.wind < -0.5 ? "#4ade80" : "var(--text-2)"} />
        <div style={{ marginLeft: 10, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: d.wind > 0 ? "#ff5470" : d.wind < -0.5 ? "#4ade80" : "var(--text-2)" }}>
            {d.wind > 0.5 ? "Protivietor" : d.wind < -0.5 ? "Zadný vietor" : "Bezvetrie"}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-3)" }}>{d.wind > 0 ? "spomaľuje ťa" : d.wind < -0.5 ? "pomáha ti" : "neutrálny"}</div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)" }}>{Math.abs(d.wind).toFixed(1)}<span style={{ fontSize: 10, color: "var(--text-3)" }}> m/s</span></div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Mini icon={Heart} label="Tep" value={d.hr} unit="bpm" c="#ff5470" badge={`Z${d.zone.zone}`} badgeC={d.zone.color} />
        <Mini icon={Activity} label="Zóna" value={d.zone.label} c={d.zone.color} small />
      </div>
    </div>
  );
}

function Mini({ icon: Icon, label, value, unit, c, badge, badgeC, small }) {
  return (
    <div style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
        <Icon size={12} color={c} />
        <span style={{ fontSize: 10, color: "var(--text-2)", fontWeight: 600 }}>{label}</span>
        {badge && <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 800, color: "#0d1320", background: badgeC, padding: "1px 6px", borderRadius: 6 }}>{badge}</span>}
      </div>
      <div style={{ fontSize: small ? 14 : 22, fontWeight: 800, color: "var(--text)" }}>
        {value}{unit && <span style={{ fontSize: 11, color: "var(--text-3)" }}> {unit}</span>}
      </div>
    </div>
  );
}
