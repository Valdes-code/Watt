import React, { useState, useRef } from "react";
import { Upload, FileText, Check, MapPin, Zap, Mountain, AlertCircle, ChevronRight } from "lucide-react";
import { importGpx } from "../lib/gpx.js";
import { SAMPLE_GPX } from "../lib/sampleGpx.js";

const SAMPLE_FILES = [
  { name: "Morning_Ride.gpx", source: "Strava", gpx: SAMPLE_GPX.morning },
  { name: "Activity_2026.gpx", source: "Garmin", gpx: SAMPLE_GPX.garmin },
  { name: "Tatry_climb.fit", source: "Garmin FIT", unsupported: true },
];

export default function GpxImport() {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Z výstupu analyzeRide() spraví tvar, ktorý zobrazuje "done" panel nižšie.
  const toResult = (name, ride) => ({
    name,
    dist: ride.distanceKm,
    power: ride.avgPower,
    elev: ride.elevationGain,
    hasPower: ride.hasPower,
  });

  const parseText = (name, text) => {
    setStatus("loading");
    setResult(null);
    setError(null);
    // Drobné oneskorenie, aby bol viditeľný stav spracovania pri malých súboroch.
    setTimeout(() => {
      try {
        const ride = importGpx(text);
        setResult(toResult(name, ride));
        setStatus("done");
      } catch (e) {
        setError(e.message);
        setStatus("error");
      }
    }, 400);
  };

  // Klik na ukážkový súbor
  const importFile = (file) => {
    if (file.unsupported) {
      setError(null);
      setStatus("error");
      setResult(null);
      return;
    }
    parseText(file.name, file.gpx);
  };

  // Skutočný výber súboru zo zariadenia
  const onPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (/\.fit$/i.test(file.name)) {
      setError(null);
      setStatus("error");
      setResult(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => parseText(file.name, String(reader.result));
    reader.readAsText(file);
  };

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 50% 0%, #1a2744, #0a0f1c 60%)", padding: 22, fontFamily: "'Inter',sans-serif", display: "flex", justifyContent: "center" }}>
      <div style={{ width: 400 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: "#fff" }}>Import jazdy</div>
        <div style={{ fontSize: 12.5, color: "#8a99b8", marginTop: 6, marginBottom: 20, lineHeight: 1.5 }}>
          Načítaj jazdu z GPX súboru. Ak chýba výkon, appka ho dopočíta z trasy.
        </div>

        {/* Drop zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{ border: "2px dashed #2a3957", borderRadius: 16, padding: 28, textAlign: "center", marginBottom: 20, background: "#0d1424", cursor: "pointer" }}
        >
          <Upload size={32} color="#6b7a99" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 13, color: "#8a99b8", fontWeight: 600 }}>Vyber súbor zo zariadenia</div>
          <div style={{ fontSize: 11, color: "#5d6b88", marginTop: 4 }}>alebo skús ukážkové nižšie</div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".gpx,application/gpx+xml,text/xml"
            onChange={onPick}
            style={{ display: "none" }}
          />
        </div>

        {/* Sample files */}
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8a99b8", letterSpacing: 0.5, marginBottom: 10 }}>UKÁŽKOVÉ SÚBORY</div>
        {SAMPLE_FILES.map((file) => (
          <div key={file.name} onClick={() => importFile(file)} style={{
            display: "flex", alignItems: "center", gap: 12, background: "#101725",
            border: "1px solid #1e2940", borderRadius: 12, padding: 14, marginBottom: 9, cursor: "pointer",
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: file.unsupported ? "#ff547022" : "#7fb0ff22", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileText size={18} color={file.unsupported ? "#ff5470" : "#7fb0ff"} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{file.name}</div>
              <div style={{ fontSize: 10.5, color: "#6b7a99" }}>{file.source}{file.unsupported ? " · nepodporované" : " · GPX"}</div>
            </div>
            <ChevronRight size={18} color="#6b7a99" />
          </div>
        ))}

        {/* Loading */}
        {status === "loading" && (
          <div style={{ background: "#101725", border: "1px solid #1e2940", borderRadius: 14, padding: 18, marginTop: 16, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#ffd54a", fontWeight: 700 }}>Spracúvam dáta…</div>
            <div style={{ fontSize: 11, color: "#6b7a99", marginTop: 4 }}>parsujem GPS body, dopočítavam výkon</div>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div style={{ background: "#ff54701a", border: "1px solid #ff547055", borderRadius: 14, padding: 16, marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <AlertCircle size={16} color="#ff5470" />
              <span style={{ fontSize: 13, fontWeight: 800, color: "#ff5470" }}>
                {error ? "Súbor sa nepodarilo načítať" : "Nepodporovaný formát"}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#c5d0e6", lineHeight: 1.5 }}>
              {error
                ? error
                : "Súbory .fit (binárny Garmin formát) zatiaľ nepodporujeme. Exportuj jazdu ako .gpx – väčšina appiek to umožňuje."}
            </div>
          </div>
        )}

        {/* Done */}
        {status === "done" && result && (
          <div style={{ background: "#4ade801a", border: "1px solid #4ade8055", borderRadius: 14, padding: 16, marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Check size={16} color="#4ade80" />
              <span style={{ fontSize: 14, fontWeight: 800, color: "#4ade80" }}>Jazda importovaná</span>
            </div>
            <div style={{ fontSize: 11.5, color: "#8a99b8", marginBottom: 14 }}>{result.name}</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <St icon={MapPin} value={result.dist.toFixed(1)} unit="km" label="Vzdialenosť" c="#7fb0ff" />
              <St icon={Zap} value={result.power} unit="W" label="⌀ výkon" c="#ffd54a" />
              <St icon={Mountain} value={result.elev} unit="m" label="Prevýšenie" c="#ff8a3d" />
            </div>
            <div style={{ fontSize: 11.5, color: "#4ade80", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
              {result.hasPower ? "✓ výkon z merača v súbore" : "✓ výkon dopočítaný z trasy"}
            </div>
            <div style={{ fontSize: 11, color: "#6b7a99", marginTop: 8 }}>Nájdeš ju v Histórii a Analýze.</div>
          </div>
        )}

        <p style={{ fontSize: 11, color: "#5d6b88", textAlign: "center", marginTop: 20, lineHeight: 1.5 }}>
          Skús ukážkové súbory hore. GPX z Garmin/Strava obsahuje výkon, zo Stravy sa dopočíta. 🚴
        </p>
      </div>
    </div>
  );
}

function St({ icon: Icon, value, unit, label, c }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
        <Icon size={11} color={c} />
        <span style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>{value}<span style={{ fontSize: 10, color: "#6b7a99" }}> {unit}</span></span>
      </div>
      <div style={{ fontSize: 9.5, color: "#6b7a99" }}>{label}</div>
    </div>
  );
}
