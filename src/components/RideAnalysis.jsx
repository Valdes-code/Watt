import React, { useState, useMemo, useRef } from "react";
import {
  Zap, Heart, Wind, Mountain, Gauge, TrendingUp,
  MapPin, Activity, Cpu, ChevronLeft, ChevronRight, Flag,
} from "lucide-react";

// ── Engine (shared with dashboard) ──────────────────────────────
const G = 9.80665, DT = 0.976;
function airDensity(alt = 200, t = 15) {
  const p = 101325 * Math.exp((-G * 0.0289644 * alt) / (8.31447 * (t + 273.15)));
  return p / (287.058 * (t + 273.15));
}
function estimateCdA(hM, mKg, pos = "hoods") {
  const bsa = 0.007184 * Math.pow(hM * 100, 0.725) * Math.pow(mKg, 0.425);
  const pf = { hoods: 0.32, drops: 0.28, aero: 0.23, upright: 0.4 }[pos];
  const Cd = { hoods: 1.0, drops: 0.88, aero: 0.7, upright: 1.15 }[pos];
  return Cd * (bsa * pf + 0.07);
}
function calcPhys({ speed, slope, totalMass, cda, crr, rho, wind }) {
  const air = speed + wind;
  const pGrav = totalMass * G * slope * speed;
  const pAir = 0.5 * rho * cda * air * air * speed;
  const pRoll = totalMass * G * crr * Math.cos(Math.atan(slope)) * speed;
  return { total: Math.max(0, Math.round((pGrav + pAir + pRoll) / DT)) };
}
function physicsTrust({ slope, speed }) {
  let t = 1;
  if (slope < -0.005) t -= Math.min(0.7, Math.abs(slope) * 30);
  if (speed < 2) t -= 0.4;
  return Math.max(0.05, Math.min(1, t));
}
function fuse(physTotal, hrP, trust, hrConf = 0.85) {
  const hrW = (1 - trust) * hrConf;
  const power = Math.max(0, Math.round(physTotal * (1 - hrW) + hrP * hrW));
  let source = "fúzia";
  if (hrW < 0.15) source = "fyzika";
  else if (hrW > 0.7) source = "tep";
  return { power, source };
}
function hrZone(hr, rest = 60, max = 190) {
  const pct = (hr - rest) / (max - rest);
  if (pct < 0.6) return { zone: 1, label: "Regenerácia", color: "#4ade80" };
  if (pct < 0.7) return { zone: 2, label: "Vytrvalosť", color: "#7fb0ff" };
  if (pct < 0.8) return { zone: 3, label: "Tempo", color: "#ffd54a" };
  if (pct < 0.9) return { zone: 4, label: "Prah", color: "#ff8a3d" };
  return { zone: 5, label: "VO2 max", color: "#ff5470" };
}

const CFG = { rider: 75, bike: 8.5, height: 180, crr: 0.0052, pos: "hoods", restHR: 60, maxHR: 190 };

// ── Generate a synthetic ride: GPS path + per-point metrics ─────
function buildRide(nPoints = 120) {
  const cda = estimateCdA(CFG.height / 100, CFG.rider, CFG.pos);
  const rho = airDensity();
  const pts = [];
  // A looping scenic path (normalized 0..1 coords)
  for (let i = 0; i < nPoints; i++) {
    const f = i / (nPoints - 1);
    // Winding route using layered sines
    const x = 0.1 + 0.8 * (0.5 + 0.42 * Math.sin(f * Math.PI * 2.2) + 0.12 * Math.sin(f * Math.PI * 6));
    const y = 0.12 + 0.76 * (f * 0.9 + 0.12 * Math.sin(f * Math.PI * 3.5) + 0.05 * Math.cos(f * Math.PI * 7));
    // Slope profile: flat -> climb -> descent -> rolling
    let slopePct;
    if (f < 0.25) slopePct = 0 + 1.5 * Math.sin(f * 20);
    else if (f < 0.5) slopePct = 4 + 4 * Math.sin((f - 0.25) * 12);
    else if (f < 0.68) slopePct = -6 + 2 * Math.sin((f - 0.5) * 14);
    else slopePct = 1 + 3 * Math.sin((f - 0.68) * 16);

    const baseSpeed = slopePct > 3 ? 14 : slopePct < -2 ? 46 : 31;
    const speed = Math.max(5, baseSpeed + 3 * Math.sin(f * 40)) / 3.6;
    const slope = slopePct / 100;
    const effortHR = CFG.restHR + (CFG.maxHR - CFG.restHR) *
      Math.min(1, (slopePct > 0 ? 0.55 + slopePct * 0.035 : 0.42) + 0.03 * Math.sin(f * 30));
    const phys = calcPhys({ speed, slope, totalMass: CFG.rider + CFG.bike, cda, crr: CFG.crr, rho, wind: 2 / 3.6 });
    const hrP = Math.max(0, Math.round(2.6 * effortHR - 150));
    const trust = physicsTrust({ slope, speed });
    const { power, source } = fuse(phys.total, hrP, trust);
    pts.push({
      x, y, dist: f * 42, // 42 km ride
      power, source,
      hr: Math.round(effortHR),
      speed: +(speed * 3.6).toFixed(1),
      slope: +slopePct.toFixed(1),
      zone: hrZone(effortHR, CFG.restHR, CFG.maxHR),
    });
  }
  return pts;
}

// Power → heat color (blue→green→yellow→red)
function powerColor(p, min, max) {
  const t = Math.max(0, Math.min(1, (p - min) / (max - min || 1)));
  // interpolate through stops
  const stops = [
    [59, 130, 246],   // blue
    [74, 222, 128],   // green
    [255, 213, 74],   // yellow
    [255, 84, 112],   // red
  ];
  const seg = t * (stops.length - 1);
  const i = Math.floor(seg);
  const frac = seg - i;
  const a = stops[i], b = stops[Math.min(stops.length - 1, i + 1)];
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * frac));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const W = 360, H = 300; // map canvas size

export default function RideAnalysis() {
  const ride = useMemo(() => buildRide(120), []);
  const [idx, setIdx] = useState(60);
  const [mode, setMode] = useState("power"); // 'power' | 'zone'
  const graphRef = useRef();

  const powers = ride.map((p) => p.power);
  const minP = Math.min(...powers), maxP = Math.max(...powers);
  const cur = ride[idx];

  const colorFor = (p) =>
    mode === "power" ? powerColor(p.power, minP, maxP) : p.zone.color;

  // Map path points to pixel coords
  const px = (p) => ({ x: p.x * W, y: p.y * H });

  // Build colored segments for the route
  const segments = ride.slice(0, -1).map((p, i) => {
    const a = px(p), b = px(ride[i + 1]);
    return { a, b, color: colorFor(p), i };
  });

  // Stats
  const avgP = Math.round(powers.reduce((s, v) => s + v, 0) / powers.length);
  const maxPower = maxP;
  const totalDist = ride[ride.length - 1].dist;

  const handleGraph = (e) => {
    const rect = graphRef.current.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    const newIdx = Math.max(0, Math.min(ride.length - 1, Math.round(rel * (ride.length - 1))));
    setIdx(newIdx);
  };

  const curPos = px(cur);

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at 50% -10%, #1a2744 0%, #0a0f1c 55%, #060911 100%)",
      padding: 20, fontFamily: "'Inter',sans-serif", display: "flex", justifyContent: "center",
    }}>
      <div style={{ width: 400 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg,#ffd54a,#ff8a3d)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <MapPin size={19} color="#0d1320" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>Analýza jazdy</div>
            <div style={{ fontSize: 11, color: "#6b7a99" }}>
              {totalDist.toFixed(1)} km · ⌀ {avgP} W · max {maxPower} W
            </div>
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[
            { k: "power", t: "Podľa výkonu" },
            { k: "zone", t: "Podľa zón" },
          ].map((m) => {
            const on = mode === m.k;
            return (
              <button key={m.k} onClick={() => setMode(m.k)} style={{
                flex: 1, padding: "9px", borderRadius: 10, cursor: "pointer",
                fontSize: 12.5, fontWeight: 700,
                border: on ? "1px solid #ffd54a" : "1px solid #1e2940",
                background: on ? "rgba(255,213,74,0.12)" : "#141c2e",
                color: on ? "#ffd54a" : "#8a99b8",
              }}>{m.t}</button>
            );
          })}
        </div>

        {/* MAP */}
        <div style={{
          background: "#0d1424", border: "1px solid #1e2940",
          borderRadius: 18, padding: 12, marginBottom: 12, position: "relative",
        }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair" }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const mx = ((e.clientX - rect.left) / rect.width) * W;
              const my = ((e.clientY - rect.top) / rect.height) * H;
              // find nearest point
              let best = 0, bd = Infinity;
              ride.forEach((p, i) => {
                const q = px(p);
                const d = (q.x - mx) ** 2 + (q.y - my) ** 2;
                if (d < bd) { bd = d; best = i; }
              });
              setIdx(best);
            }}
          >
            {/* subtle grid */}
            {[...Array(6)].map((_, i) => (
              <line key={"v" + i} x1={(i * W) / 6} y1={0} x2={(i * W) / 6} y2={H} stroke="#141c2e" strokeWidth="1" />
            ))}
            {[...Array(5)].map((_, i) => (
              <line key={"h" + i} x1={0} y1={(i * H) / 5} x2={W} y2={(i * H) / 5} stroke="#141c2e" strokeWidth="1" />
            ))}
            {/* route halo */}
            {segments.map((s) => (
              <line key={"halo" + s.i} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y}
                stroke="#000" strokeWidth="7" strokeLinecap="round" opacity="0.35" />
            ))}
            {/* colored route */}
            {segments.map((s) => (
              <line key={s.i} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y}
                stroke={s.color} strokeWidth="4.5" strokeLinecap="round" />
            ))}
            {/* start / finish */}
            <circle cx={px(ride[0]).x} cy={px(ride[0]).y} r="6" fill="#4ade80" stroke="#0d1320" strokeWidth="2" />
            <circle cx={px(ride[ride.length - 1]).x} cy={px(ride[ride.length - 1]).y} r="6" fill="#ff5470" stroke="#0d1320" strokeWidth="2" />
            {/* current marker */}
            <circle cx={curPos.x} cy={curPos.y} r="11" fill="none" stroke="#fff" strokeWidth="2.5" opacity="0.9" />
            <circle cx={curPos.x} cy={curPos.y} r="6" fill="#fff" />
          </svg>

          {/* floating tooltip */}
          <div style={{
            position: "absolute", top: 18, right: 18,
            background: "rgba(13,20,36,0.92)", border: "1px solid #1e2940",
            borderRadius: 12, padding: "10px 13px", backdropFilter: "blur(8px)",
            minWidth: 96,
          }}>
            <div style={{ fontSize: 10, color: "#6b7a99", fontWeight: 600 }}>
              {cur.dist.toFixed(1)} km
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: colorFor(cur), lineHeight: 1.1 }}>
              {cur.power}<span style={{ fontSize: 13, marginLeft: 2 }}>W</span>
            </div>
            <div style={{ fontSize: 10.5, color: cur.zone.color, fontWeight: 600 }}>
              {cur.zone.label}
            </div>
          </div>
        </div>

        {/* GRAPH (scrub) */}
        <div style={{ background: "#101725", border: "1px solid #1e2940", borderRadius: 16, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#8a99b8", letterSpacing: 0.5 }}>VÝKON POZDĹŽ TRASY</span>
            <span style={{ fontSize: 11, color: "#6b7a99" }}>klikni alebo potiahni ↓</span>
          </div>
          <div
            ref={graphRef}
            onMouseDown={handleGraph}
            onMouseMove={(e) => e.buttons === 1 && handleGraph(e)}
            style={{ position: "relative", height: 90, cursor: "pointer", display: "flex", alignItems: "flex-end", gap: 1 }}
          >
            {ride.map((p, i) => (
              <div key={i} style={{
                flex: 1,
                height: `${Math.max(4, ((p.power - minP) / (maxP - minP || 1)) * 100)}%`,
                background: i === idx ? "#fff" : colorFor(p),
                opacity: i === idx ? 1 : 0.85,
                borderRadius: 1,
              }} />
            ))}
            {/* position line */}
            <div style={{
              position: "absolute", top: 0, bottom: 0,
              left: `${(idx / (ride.length - 1)) * 100}%`,
              width: 2, background: "#fff", pointerEvents: "none",
            }} />
          </div>
          {/* slider for fine control */}
          <input
            type="range" min={0} max={ride.length - 1} value={idx}
            onChange={(e) => setIdx(parseInt(e.target.value))}
            style={{ width: "100%", marginTop: 10, accentColor: "#ff8a3d", cursor: "pointer" }}
          />
        </div>

        {/* DETAIL at current point */}
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <Stat icon={Zap} label="Výkon" value={cur.power} unit="W" color={colorFor(cur)} />
          <Stat icon={Heart} label="Tep" value={cur.hr} unit="bpm" color="#ff5470" />
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <Stat icon={Gauge} label="Rýchlosť" value={cur.speed} unit="km/h" color="#7fb0ff" />
          <Stat icon={TrendingUp} label="Sklon" value={cur.slope} unit="%" color="#ff8a3d" />
        </div>

        {/* source + nav */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "#101725", border: "1px solid #1e2940",
          borderRadius: 14, padding: "10px 12px",
        }}>
          <button onClick={() => setIdx((i) => Math.max(0, i - 1))} style={navBtn}>
            <ChevronLeft size={18} />
          </button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "#ffd54a" }}>
              <Cpu size={12} /> zdroj: {cur.source}
            </div>
            <div style={{ fontSize: 10.5, color: "#6b7a99", marginTop: 2 }}>
              bod {idx + 1} / {ride.length}
            </div>
          </div>
          <button onClick={() => setIdx((i) => Math.min(ride.length - 1, i + 1))} style={navBtn}>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, justifyContent: "center" }}>
          {mode === "power" ? (
            <>
              <span style={{ fontSize: 10.5, color: "#6b7a99" }}>{minP}W</span>
              <div style={{ width: 140, height: 8, borderRadius: 4, background: "linear-gradient(90deg,#3b82f6,#4ade80,#ffd54a,#ff5470)" }} />
              <span style={{ fontSize: 10.5, color: "#6b7a99" }}>{maxP}W</span>
            </>
          ) : (
            [1, 2, 3, 4, 5].map((z) => {
              const c = hrZone(CFG.restHR + (CFG.maxHR - CFG.restHR) * (0.5 + z * 0.08)).color;
              return <span key={z} style={{ fontSize: 10, fontWeight: 700, color: "#0d1320", background: c, padding: "2px 8px", borderRadius: 6 }}>Z{z}</span>;
            })
          )}
        </div>

        <p style={{ fontSize: 11, color: "#5d6b88", textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
          Klikni kdekoľvek na mapu alebo potiahni po grafe – uvidíš výkon, tep a sklon
          v danom mieste. V reálnej appke tu bude skutočná mapa (Mapbox / Apple Maps).
        </p>
      </div>
    </div>
  );
}

const navBtn = {
  width: 38, height: 38, borderRadius: 10, border: "1px solid #1e2940",
  background: "#0a0f1c", color: "#8a99b8", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};

function Stat({ icon: Icon, label, value, unit, color }) {
  return (
    <div style={{ flex: 1, background: "#101725", border: "1px solid #1e2940", borderRadius: 14, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <Icon size={13} color={color} />
        <span style={{ fontSize: 11, color: "#8a99b8", fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>
        {value}<span style={{ fontSize: 12, color: "#6b7a99", marginLeft: 3 }}>{unit}</span>
      </div>
    </div>
  );
}
