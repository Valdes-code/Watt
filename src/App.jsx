import React, { useState, useEffect } from "react";
import CycloWattPreview from "./components/CycloWattPreview.jsx";
import RideAnalysis from "./components/RideAnalysis.jsx";
import GpxImport from "./components/GpxImport.jsx";
import RideHistory from "./components/RideHistory.jsx";
import PoseDetectionDemo from "./components/PoseDetectionDemo.jsx";
import Settings from "./components/Settings.jsx";
import { useTheme } from "./lib/useTheme.js";

// „Analýza jazdy" je zlúčená: najprv výber/import jazdy, po vybraní sa zobrazí
// analýza s mapou. Samostatná záložka „Import GPX" už nie je.
const VIEWS = {
  ride: { label: "Analýza jazdy" },
  history: { label: "História jázd" },
  preview: { label: "Appka" },
  pose: { label: "Detekcia polohy" },
  profile: { label: "Profil" },
};

export default function App() {
  const [view, setView] = useState("ride");
  const [imported, setImported] = useState(null); // { name, ...analyzeRide() } – vybraná jazda
  const [activeGpx, setActiveGpx] = useState(null); // GPX práve aktívnej trasy (na zvýraznenie v histórii)
  const theme = useTheme();

  // Po spustení appky sa zobrazí výber jazdy. Poslednú trasu z histórie len
  // zvýrazníme (activeGpx), nenačítavame rovno analýzu – jazdu si vyberie používateľ.
  useEffect(() => {
    try {
      const hist = JSON.parse(localStorage.getItem("watt_gpx_history")) || [];
      if (hist[0]?.gpx) setActiveGpx(hist[0].gpx);
    } catch { /* žiadna/poškodená história */ }
  }, []);

  // Volá sa po vybraní jazdy (z výberu/importu alebo z Histórie) – zobrazí analýzu.
  const handleImported = (name, ride, gpx) => {
    setImported({ name, ...ride });
    setActiveGpx(gpx ?? null);
    setView("ride");
  };
  // Späť na výber jazdy (v rámci „Analýza jazdy").
  const pickAnother = () => { setImported(null); setView("ride"); };

  const renderActive = () => {
    if (view === "ride")
      return imported
        ? <RideAnalysis imported={imported} onClearImport={pickAnother} />
        : <GpxImport onImported={handleImported} activeGpx={activeGpx} />;
    if (view === "history") return <RideHistory onOpen={handleImported} activeGpx={activeGpx} onGoImport={pickAnother} />;
    if (view === "pose") return <PoseDetectionDemo />;
    if (view === "profile") return <Settings theme={theme} />;
    return <CycloWattPreview />;
  };

  return (
    <div style={{ background: "var(--bg-app)", minHeight: "100vh" }}>
      <nav style={{
        display: "flex", gap: 8, padding: "10px 14px", flexWrap: "wrap",
        background: "var(--nav-bg)", borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, zIndex: 10, fontFamily: "'Inter',sans-serif",
      }}>
        {Object.entries(VIEWS).map(([k, v]) => {
          const on = view === k;
          return (
            <button key={k} onClick={() => setView(k)} style={{
              padding: "7px 13px", borderRadius: 10, cursor: "pointer", fontSize: 12.5, fontWeight: 700,
              border: on ? "1px solid #ffd54a" : "1px solid var(--border)",
              background: on ? "rgba(255,213,74,0.12)" : "var(--surface-3)",
              color: on ? "#ffd54a" : "var(--text-2)",
            }}>{v.label}</button>
          );
        })}
      </nav>
      {renderActive()}
    </div>
  );
}
