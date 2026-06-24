import React, { useState, useRef, useEffect } from "react";
import { Upload, Check, MapPin, Zap, Mountain, AlertCircle, Clock, X } from "lucide-react";
import { importGpx } from "../lib/gpx.js";
import { SAMPLE_GPX } from "../lib/sampleGpx.js";

// História importov v localStorage (uchová raw GPX, aby sa dala trasa znova načítať).
const HKEY = "watt_gpx_history";
const HMAX = 8;
const loadHistory = () => {
  try { return JSON.parse(localStorage.getItem(HKEY)) || []; } catch { return []; }
};
const saveHistory = (arr) => {
  try { localStorage.setItem(HKEY, JSON.stringify(arr)); } catch { /* plný/zakázaný storage */ }
};

const SAMPLE_FILES = [
  { name: "Morning_Ride.gpx", source: "Strava", gpx: SAMPLE_GPX.morning },
  { name: "Activity_2026.gpx", source: "Garmin", gpx: SAMPLE_GPX.garmin },
  { name: "Vikendovy_okruh.gpx", source: "Plánovaná trasa", gpx: SAMPLE_GPX.route },
  { name: "Tatry_climb.fit", source: "Garmin FIT", unsupported: true },
];

export default function GpxImport({ onImported }) {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [fullRide, setFullRide] = useState(null); // celý výstup analyzeRide (vč. track)
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const doneRef = useRef(null);
  const [history, setHistory] = useState(loadHistory);

  // Pridaj/posuň trasu na vrchol histórie (dedup podľa obsahu GPX, max HMAX).
  const pushHistory = (name, text, ride) => {
    const entry = { id: String(Date.now()), name, dist: ride.distanceKm, planned: !!ride.planned, ts: Date.now(), gpx: text };
    setHistory((h) => {
      const next = [entry, ...h.filter((e) => e.gpx !== text)].slice(0, HMAX);
      saveHistory(next);
      return next;
    });
  };
  const removeHistory = (id) => setHistory((h) => { const next = h.filter((e) => e.id !== id); saveHistory(next); return next; });

  // Po úspešnom načítaní odroluj na panel „Trasa pripravená", nech ho netreba hľadať.
  useEffect(() => {
    if (status === "done") {
      doneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [status]);

  // Z výstupu analyzeRide() spraví tvar, ktorý zobrazuje "done" panel nižšie.
  const toResult = (name, ride) => ({
    name,
    dist: ride.distanceKm,
    power: ride.avgPower,
    elev: ride.elevationGain,
    hasPower: ride.hasPower,
    planned: ride.planned,
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
        setFullRide({ name, ride });
        setStatus("done");
        pushHistory(name, text, ride);
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

        {/* História importov (nahradila ukážkové súbory) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#8a99b8", letterSpacing: 0.5 }}>HISTÓRIA IMPORTOV</span>
          {history.length > 0 && (
            <span onClick={() => { setHistory([]); saveHistory([]); }} style={{ fontSize: 10.5, fontWeight: 700, color: "#6b7a99", cursor: "pointer" }}>Vymazať</span>
          )}
        </div>
        {history.length === 0 ? (
          <div style={{ background: "#101725", border: "1px solid #1e2940", borderRadius: 12, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 12.5, color: "#8a99b8", fontWeight: 600 }}>Zatiaľ žiadne importy</div>
            <div style={{ fontSize: 11.5, color: "#6b7a99", marginTop: 6, lineHeight: 1.5 }}>
              Načítaj GPX súbor hore, alebo{" "}
              <span
                onClick={() => importFile(SAMPLE_FILES.find((f) => f.source === "Plánovaná trasa"))}
                style={{ color: "#7fb0ff", fontWeight: 700, cursor: "pointer" }}
              >skús ukážkovú trasu</span>.
            </div>
          </div>
        ) : (
          history.map((e) => (
            <div key={e.id} onClick={() => parseText(e.name, e.gpx)} style={{
              display: "flex", alignItems: "center", gap: 12, background: "#101725",
              border: "1px solid #1e2940", borderRadius: 12, padding: 12, marginBottom: 9, cursor: "pointer",
            }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#7fb0ff14", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Clock size={16} color="#7fb0ff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>
                <div style={{ fontSize: 10.5, color: "#6b7a99" }}>
                  {new Date(e.ts).toLocaleString("sk-SK", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {e.dist.toFixed(1)} km{e.planned ? " · plán" : ""}
                </div>
              </div>
              <button
                onClick={(ev) => { ev.stopPropagation(); removeHistory(e.id); }}
                title="Odstrániť z histórie"
                style={{ background: "transparent", border: "none", color: "#6b7a99", cursor: "pointer", padding: 4, display: "flex" }}
              >
                <X size={15} />
              </button>
            </div>
          ))
        )}

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
          <div ref={doneRef} style={{ background: "#4ade801a", border: "1px solid #4ade8055", borderRadius: 14, padding: 16, marginTop: 16, scrollMarginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Check size={16} color="#4ade80" />
              <span style={{ fontSize: 14, fontWeight: 800, color: "#4ade80" }}>
                {result.planned ? "Trasa pripravená" : "Jazda importovaná"}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: "#8a99b8", marginBottom: 14 }}>{result.name}</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <St icon={MapPin} value={result.dist.toFixed(1)} unit="km" label="Vzdialenosť" c="#7fb0ff" />
              <St icon={Zap} value={result.power} unit="W" label={result.planned ? "⌀ odhad" : "⌀ výkon"} c="#ffd54a" />
              <St icon={Mountain} value={result.elev} unit="m" label="Prevýšenie" c="#ff8a3d" />
            </div>
            <div style={{ fontSize: 11.5, color: "#4ade80", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
              {result.planned
                ? "✓ plánovaná trasa – výkon je odhad pri ~22 km/h"
                : result.hasPower
                  ? "✓ výkon z merača v súbore"
                  : "✓ výkon dopočítaný z trasy"}
            </div>
            <button
              onClick={() => fullRide && onImported?.(fullRide.name, fullRide.ride)}
              style={{
                width: "100%", marginTop: 14, background: "#ffd54a", border: "none",
                borderRadius: 12, padding: 13, cursor: "pointer", fontSize: 13.5, fontWeight: 800,
                color: "#0d1320", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              }}
            >
              <MapPin size={15} /> Zobraziť trasu na mape
            </button>
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
