import React, { useState, useEffect } from "react";
import { Check, Search } from "lucide-react";

// Pripojené BLE snímače (presunuté z mockupu „Appka") – simulácia skenovania/pripojenia.
const FAKE_DEVICES = [
  { id: "1", name: "Wahoo TICKR", type: "hr", rssi: -52 },
  { id: "2", name: "Favero Assioma", type: "power", rssi: -61 },
  { id: "3", name: "Garmin Cadence", type: "cadence", rssi: -70 },
];

const sectionStyle = { fontSize: 11, fontWeight: 700, color: "#ffd54a", letterSpacing: 0.5, marginTop: 16, marginBottom: 8 };
const deviceStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 13, marginBottom: 8 };

export default function SensorsPanel() {
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

  const hasHR = connected.some((c) => c.type === "hr");
  const hasPower = connected.some((c) => c.type === "power");
  const hasCad = connected.some((c) => c.type === "cadence");
  const hr = Math.round(126 + 10 * Math.sin(t));
  const power = Math.round(245 + 55 * Math.sin(t * 0.8));

  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 12, lineHeight: 1.4 }}>
        Pripoj BLE snímače. Chýbajúce dáta appka dopočíta.
      </div>

      {/* live preview */}
      <div style={{ display: "flex", gap: 7, marginBottom: 14 }}>
        <LiveChip label="Tep" value={hasHR ? hr : null} unit="bpm" c="#ff5470" />
        <LiveChip label="Výkon" value={hasPower ? power : null} unit="W" c="#ffd54a" />
        <LiveChip label="Kadencia" value={hasCad ? 88 : null} unit="ot" c="#7fb0ff" />
      </div>

      {connected.length > 0 && (
        <>
          <div style={sectionStyle}>PRIPOJENÉ</div>
          {connected.map((c) => (
            <div key={c.id} style={{ ...deviceStyle, borderColor: "#4ade80" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Check size={15} color="#4ade80" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{c.name}</span>
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
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{dev.name}</div>
                <div style={{ fontSize: 10, color: "var(--text-3)" }}>signál {dev.rssi} dBm</div>
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
    <div style={{ flex: 1, background: "var(--surface)", border: `1px solid ${on ? c : "var(--border)"}`, borderRadius: 12, padding: 10, textAlign: "center" }}>
      <div style={{ fontSize: 9.5, color: "var(--text-2)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: on ? c : "var(--text-3)", margin: "2px 0" }}>{on ? value : "—"}</div>
      <div style={{ fontSize: 9, color: "var(--text-4)" }}>{unit}</div>
    </div>
  );
}
