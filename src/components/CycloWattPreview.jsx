import React, { useState, useEffect, useRef } from "react";
import {
  Zap, Heart, Wind, Gauge, TrendingUp, Activity, Cpu,
  Bluetooth, MapPin, Play, Pause, Check, Search, X,
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
  const [tab, setTab] = useState("ride");
  return (
    <div style={{
      minHeight: "100vh", background: "radial-gradient(circle at 50% 0%, #1a2744, #0a0f1c 60%)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      fontFamily: "'Inter',sans-serif",
    }}>
      <div style={{
        width: PHONE_W, height: 640, background: "#0a0f1c", borderRadius: 38,
        border: "1px solid #1e2940", boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        overflow: "hidden", display: "flex", flexDirection: "column", position: "relative",
      }}>
        {/* status bar */}
        <div style={{ height: 32, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 6 }}>
          <div style={{ width: 90, height: 5, borderRadius: 3, background: "#1e2940" }} />
        </div>

        {/* content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {tab === "ride" && <RideTab />}
          {tab === "sensors" && <SensorsTab />}
        </div>

        {/* tab bar */}
        <div style={{
          height: 60, borderTop: "1px solid #1e2940", background: "#0d1320",
          display: "flex", alignItems: "center", justifyContent: "space-around", paddingBottom: 4,
        }}>
          <TabBtn icon={Zap} label="Jazda" active={tab === "ride"} onClick={() => setTab("ride")} />
          <TabBtn icon={Bluetooth} label="Snímače" active={tab === "sensors"} onClick={() => setTab("sensors")} />
        </div>
      </div>
    </div>
  );
}

function TabBtn({ icon: Icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: "none", cursor: "pointer", display: "flex",
      flexDirection: "column", alignItems: "center", gap: 3,
      color: active ? "#ffd54a" : "#6b7a99",
    }}>
      <Icon size={20} />
      <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
    </button>
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
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>Záznam jazdy</div>
          <div style={{ fontSize: 10.5, color: d.zone.color, fontWeight: 600 }}>{d.seg.label}</div>
        </div>
        <button onClick={() => setRunning((r) => !r)} style={{
          marginLeft: "auto", width: 34, height: 34, borderRadius: 10,
          border: "1px solid #1e2940", background: "#141c2e", color: "#ffd54a",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}>{running ? <Pause size={16} /> : <Play size={16} />}</button>
      </div>

      {/* power hero */}
      <div style={{ background: "#141c2e", border: "1px solid #1e2940", borderRadius: 20, padding: 18, marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: "#8a99b8", fontWeight: 600, letterSpacing: 1 }}>VÝKON</div>
        <div style={{ fontSize: 52, fontWeight: 800, color: "#fff", lineHeight: 1.1, letterSpacing: -2 }}>
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
      <div style={{ display: "flex", alignItems: "center", background: "#101725", border: "1px solid #1e2940", borderRadius: 14, padding: 12, marginBottom: 8 }}>
        <Wind size={18} color={d.wind > 0 ? "#ff5470" : d.wind < -0.5 ? "#4ade80" : "#8a99b8"} />
        <div style={{ marginLeft: 10, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: d.wind > 0 ? "#ff5470" : d.wind < -0.5 ? "#4ade80" : "#8a99b8" }}>
            {d.wind > 0.5 ? "Protivietor" : d.wind < -0.5 ? "Zadný vietor" : "Bezvetrie"}
          </div>
          <div style={{ fontSize: 10, color: "#6b7a99" }}>{d.wind > 0 ? "spomaľuje ťa" : d.wind < -0.5 ? "pomáha ti" : "neutrálny"}</div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{Math.abs(d.wind).toFixed(1)}<span style={{ fontSize: 10, color: "#6b7a99" }}> m/s</span></div>
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
    <div style={{ flex: 1, background: "#101725", border: "1px solid #1e2940", borderRadius: 14, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
        <Icon size={12} color={c} />
        <span style={{ fontSize: 10, color: "#8a99b8", fontWeight: 600 }}>{label}</span>
        {badge && <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 800, color: "#0d1320", background: badgeC, padding: "1px 6px", borderRadius: 6 }}>{badge}</span>}
      </div>
      <div style={{ fontSize: small ? 14 : 22, fontWeight: 800, color: "#fff" }}>
        {value}{unit && <span style={{ fontSize: 11, color: "#6b7a99" }}> {unit}</span>}
      </div>
    </div>
  );
}

// ── SENSORS TAB ──────────────────────────────────────────────────
const FAKE_DEVICES = [
  { id: "1", name: "Wahoo TICKR", type: "hr", rssi: -52 },
  { id: "2", name: "Favero Assioma", type: "power", rssi: -61 },
  { id: "3", name: "Garmin Cadence", type: "cadence", rssi: -70 },
];

function SensorsTab() {
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState([]);
  const [connected, setConnected] = useState([]);
  const [t, setT] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setT((p) => p + 0.25), 250);
    return () => clearInterval(id);
  }, []);

  const scan = () => {
    setScanning(true);
    setFound([]);
    FAKE_DEVICES.forEach((dev, i) => {
      setTimeout(() => setFound((p) => [...p, dev]), (i + 1) * 600);
    });
    setTimeout(() => setScanning(false), 2200);
  };
  const connect = (dev) => {
    setConnected((p) => [...p, dev]);
    setFound((p) => p.filter((d) => d.id !== dev.id));
  };
  const disconnect = (id) => setConnected((p) => p.filter((d) => d.id !== id));

  const d = frame(t);
  const hasHR = connected.some((c) => c.type === "hr");
  const hasPower = connected.some((c) => c.type === "power");
  const hasCad = connected.some((c) => c.type === "cadence");

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Snímače</div>
      <div style={{ fontSize: 11, color: "#8a99b8", marginBottom: 14, lineHeight: 1.4 }}>
        Pripoj BLE snímače. Chýbajúce dáta appka dopočíta.
      </div>

      {/* live preview */}
      <div style={{ display: "flex", gap: 7, marginBottom: 16 }}>
        <LiveChip label="Tep" value={hasHR ? d.hr : null} unit="bpm" c="#ff5470" />
        <LiveChip label="Výkon" value={hasPower ? d.power : null} unit="W" c="#ffd54a" />
        <LiveChip label="Kadencia" value={hasCad ? 88 : null} unit="ot" c="#7fb0ff" />
      </div>

      {connected.length > 0 && (
        <>
          <div style={sectionStyle}>PRIPOJENÉ</div>
          {connected.map((c) => (
            <div key={c.id} style={{ ...deviceStyle, borderColor: "#4ade80" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Check size={15} color="#4ade80" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{c.name}</span>
              </div>
              <button onClick={() => disconnect(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ff5470", fontSize: 12, fontWeight: 700 }}>Odpojiť</button>
            </div>
          ))}
        </>
      )}

      <button onClick={scan} disabled={scanning} style={{
        width: "100%", background: "#ffd54a", border: "none", borderRadius: 12,
        padding: 13, marginTop: 12, cursor: scanning ? "default" : "pointer",
        fontSize: 13.5, fontWeight: 800, color: "#0d1320",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
      }}>
        <Search size={15} /> {scanning ? "Hľadám…" : "Hľadať snímače"}
      </button>

      {found.length > 0 && (
        <>
          <div style={sectionStyle}>NÁJDENÉ</div>
          {found.map((dev) => (
            <div key={dev.id} style={deviceStyle}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{dev.name}</div>
                <div style={{ fontSize: 10, color: "#6b7a99" }}>signál {dev.rssi} dBm</div>
              </div>
              <button onClick={() => connect(dev)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ffd54a", fontSize: 12.5, fontWeight: 700 }}>Pripojiť</button>
            </div>
          ))}
        </>
      )}

      {hasPower && (
        <div style={{ marginTop: 14, padding: 11, borderRadius: 12, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)" }}>
          <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 700, lineHeight: 1.4 }}>
            ⚡ Wattmeter pripojený – appka teraz používa reálny výkon namiesto odhadu.
          </div>
        </div>
      )}
    </div>
  );
}

function LiveChip({ label, value, unit, c }) {
  const on = value != null;
  return (
    <div style={{ flex: 1, background: "#101725", border: `1px solid ${on ? c : "#1e2940"}`, borderRadius: 12, padding: 10, textAlign: "center" }}>
      <div style={{ fontSize: 9.5, color: "#8a99b8", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: on ? c : "#6b7a99", margin: "2px 0" }}>{on ? value : "—"}</div>
      <div style={{ fontSize: 9, color: "#5d6b88" }}>{unit}</div>
    </div>
  );
}

const sectionStyle = { fontSize: 11, fontWeight: 700, color: "#ffd54a", letterSpacing: 0.5, marginTop: 16, marginBottom: 8 };
const deviceStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#101725", border: "1px solid #1e2940", borderRadius: 12, padding: 13, marginBottom: 8 };
