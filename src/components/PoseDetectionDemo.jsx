import React, { useState } from "react";
import { Camera, Zap, Wind, User, Check, Activity } from "lucide-react";

// Position presets with stick-figure keypoints (front view) + CdA
const POSITIONS = {
  upright: {
    label: "Vzpriamená", cda: 0.974, color: "#ff5470",
    desc: "Najväčší odpor vzduchu – pohodlná, pomalá",
    kp: { shoulderY: 30, hipY: 78, elbowY: 48, wristY: 62, spread: 34, noseY: 14 },
  },
  hoods: {
    label: "Základná", cda: 0.692, color: "#ffd54a",
    desc: "Ruky na brzdových pákach – univerzálna",
    kp: { shoulderY: 40, hipY: 66, elbowY: 52, wristY: 64, spread: 32, noseY: 28 },
  },
  drops: {
    label: "Spodný úchop", cda: 0.540, color: "#7fb0ff",
    desc: "Ruky v dolnej časti riadidiel – rýchlejšia",
    kp: { shoulderY: 48, hipY: 58, elbowY: 56, wristY: 66, spread: 28, noseY: 40 },
  },
  aero: {
    label: "Časovkárska", cda: 0.362, color: "#4ade80",
    desc: "Predlaktia vodorovne, úzko – najrýchlejšia",
    kp: { shoulderY: 52, hipY: 55, elbowY: 53, wristY: 53, spread: 13, noseY: 50 },
  },
};

// Power at 35 km/h for a given CdA (simplified)
function powerAt(cda, speedKmh = 35) {
  const v = speedKmh / 3.6;
  const rho = 1.196, mass = 83.5, G = 9.80665, crr = 0.005;
  const pAir = 0.5 * rho * cda * v * v * v;
  const pRoll = mass * G * crr * v;
  return Math.round((pAir + pRoll) / 0.976);
}

export default function PoseDetectionDemo() {
  const [pos, setPos] = useState("hoods");
  const p = POSITIONS[pos];
  const power = powerAt(p.cda);
  const uprightPower = powerAt(POSITIONS.upright.cda);
  const savePct = Math.round((1 - power / uprightPower) * 100);

  return (
    <div style={{
      minHeight: "100vh", background: "radial-gradient(circle at 50% 0%, #1a2744, #0a0f1c 60%)",
      padding: 22, fontFamily: "'Inter',sans-serif", display: "flex", justifyContent: "center",
    }}>
      <div style={{ width: 420 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 18 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: "linear-gradient(135deg,#ffd54a,#ff8a3d)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Camera size={20} color="#0d1320" />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>Detekcia polohy</div>
            <div style={{ fontSize: 11, color: "#6b7a99" }}>Predná kamera → poloha → CdA</div>
          </div>
        </div>

        {/* Camera view simulation */}
        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1, background: "#0d1424", border: "1px solid #1e2940", borderRadius: 16, padding: 12, position: "relative" }}>
            <div style={{ fontSize: 10, color: "#6b7a99", fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
              <Camera size={11} /> KAMERA
            </div>
            <svg viewBox="0 0 100 100" style={{ width: "100%", display: "block" }}>
              {/* head */}
              <circle cx={50} cy={p.kp.noseY} r={6} fill="none" stroke={p.color} strokeWidth="2" />
              {/* shoulders line */}
              <line x1={40} y1={p.kp.shoulderY} x2={60} y2={p.kp.shoulderY} stroke={p.color} strokeWidth="2.5" />
              {/* spine */}
              <line x1={50} y1={p.kp.shoulderY} x2={50} y2={p.kp.hipY} stroke={p.color} strokeWidth="2.5" />
              {/* hips */}
              <line x1={45} y1={p.kp.hipY} x2={55} y2={p.kp.hipY} stroke={p.color} strokeWidth="2.5" />
              {/* left arm */}
              <line x1={40} y1={p.kp.shoulderY} x2={42} y2={p.kp.elbowY} stroke={p.color} strokeWidth="2" />
              <line x1={42} y1={p.kp.elbowY} x2={50 - p.kp.spread / 2} y2={p.kp.wristY} stroke={p.color} strokeWidth="2" />
              {/* right arm */}
              <line x1={60} y1={p.kp.shoulderY} x2={58} y2={p.kp.elbowY} stroke={p.color} strokeWidth="2" />
              <line x1={58} y1={p.kp.elbowY} x2={50 + p.kp.spread / 2} y2={p.kp.wristY} stroke={p.color} strokeWidth="2" />
              {/* joints */}
              {[[40, p.kp.shoulderY], [60, p.kp.shoulderY], [42, p.kp.elbowY], [58, p.kp.elbowY], [50 - p.kp.spread / 2, p.kp.wristY], [50 + p.kp.spread / 2, p.kp.wristY], [45, p.kp.hipY], [55, p.kp.hipY]].map((j, i) => (
                <circle key={i} cx={j[0]} cy={j[1]} r={2.2} fill="#fff" />
              ))}
            </svg>
            <div style={{ position: "absolute", top: 12, right: 12, display: "flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 700, color: "#4ade80" }}>
              <Check size={10} /> {Math.round(85 + Math.random() * 10)}%
            </div>
          </div>

          {/* Detected result */}
          <div style={{ flex: 1, background: "#141c2e", border: `1px solid ${p.color}40`, borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: 10, color: "#8a99b8", fontWeight: 600 }}>ROZPOZNANÉ</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: p.color, marginVertical: 4, lineHeight: 1.2 }}>{p.label}</div>
            <div style={{ fontSize: 11, color: "#8a99b8", lineHeight: 1.4, marginTop: 4 }}>{p.desc}</div>
          </div>
        </div>

        {/* CdA + Power */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, background: "#101725", border: "1px solid #1e2940", borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
              <Wind size={13} color="#7fb0ff" />
              <span style={{ fontSize: 11, color: "#8a99b8", fontWeight: 600 }}>CdA</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>{p.cda.toFixed(3)}<span style={{ fontSize: 12, color: "#6b7a99" }}> m²</span></div>
          </div>
          <div style={{ flex: 1, background: "#101725", border: "1px solid #1e2940", borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
              <Zap size={13} color="#ffd54a" />
              <span style={{ fontSize: 11, color: "#8a99b8", fontWeight: 600 }}>Výkon @ 35 km/h</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>{power}<span style={{ fontSize: 12, color: "#6b7a99" }}> W</span></div>
          </div>
        </div>

        {savePct > 0 && (
          <div style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 12, padding: 12, marginBottom: 16, textAlign: "center" }}>
            <span style={{ fontSize: 12.5, color: "#4ade80", fontWeight: 700 }}>
              O {savePct}% menej výkonu než vo vzpriamenej polohe pri rovnakej rýchlosti
            </span>
          </div>
        )}

        {/* Position selector */}
        <div style={{ fontSize: 11, color: "#8a99b8", fontWeight: 600, marginBottom: 10 }}>
          VYSKÚŠAJ POLOHY (v appke sa rozpozná automaticky):
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {Object.entries(POSITIONS).map(([k, v]) => {
            const on = pos === k;
            return (
              <button key={k} onClick={() => setPos(k)} style={{
                padding: "12px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                border: on ? `1px solid ${v.color}` : "1px solid #1e2940",
                background: on ? `${v.color}1a` : "#101725",
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: on ? v.color : "#c5d0e6" }}>{v.label}</div>
                <div style={{ fontSize: 10, color: "#6b7a99", marginTop: 2 }}>CdA {v.cda.toFixed(2)} · {powerAt(v.cda)} W</div>
              </button>
            );
          })}
        </div>

        <p style={{ fontSize: 11, color: "#5d6b88", textAlign: "center", marginTop: 18, lineHeight: 1.5 }}>
          Kamera rozpozná kĺbové body a podľa výšky ramien a polohy rúk určí polohu tela.
          Spracovanie beží na zariadení – video nikam neodchádza. 🔒
        </p>
      </div>
    </div>
  );
}
