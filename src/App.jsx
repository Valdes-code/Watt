import React, { useState, useEffect } from "react";
import CycloWattPreview from "./components/CycloWattPreview.jsx";
import RideAnalysis from "./components/RideAnalysis.jsx";
import GpxImport from "./components/GpxImport.jsx";
import PoseDetectionDemo from "./components/PoseDetectionDemo.jsx";
import { importGpx } from "./lib/gpx.js";

const VIEWS = {
  preview: { label: "Appka", Component: CycloWattPreview },
  ride: { label: "Analýza jazdy", Component: RideAnalysis },
  gpx: { label: "Import GPX", Component: GpxImport },
  pose: { label: "Detekcia polohy", Component: PoseDetectionDemo },
};

export default function App() {
  const [view, setView] = useState("gpx");
  const [imported, setImported] = useState(null); // { name, ...analyzeRide() }
  const [activeGpx, setActiveGpx] = useState(null); // GPX práve aktívnej trasy (na zvýraznenie v histórii)

  // „Analýza jazdy" má vždy poslednú importovanú trasu: pri štarte ju načítame
  // z histórie importov (localStorage), takže prežije reload aj prepnutie záložiek.
  useEffect(() => {
    try {
      const hist = JSON.parse(localStorage.getItem("watt_gpx_history")) || [];
      if (hist[0]?.gpx) {
        const ride = importGpx(hist[0].gpx);
        setImported({ name: hist[0].name, ...ride });
        setActiveGpx(hist[0].gpx);
      }
    } catch { /* žiadna/poškodená história → ostane demo */ }
  }, []);

  // GpxImport zavolá po úspešnom načítaní – uložíme jazdu a prepneme na mapu.
  const handleImported = (name, ride, gpx) => {
    setImported({ name, ...ride });
    setActiveGpx(gpx ?? null);
    setView("ride");
  };
  const clearImport = () => setImported(null);

  const renderActive = () => {
    if (view === "ride") return <RideAnalysis imported={imported} onClearImport={clearImport} />;
    if (view === "gpx") return <GpxImport onImported={handleImported} activeGpx={activeGpx} />;
    if (view === "pose") return <PoseDetectionDemo />;
    return <CycloWattPreview />;
  };

  return (
    <div style={{ background: "#060911", minHeight: "100vh" }}>
      <nav style={{
        display: "flex", gap: 8, padding: "10px 14px", flexWrap: "wrap",
        background: "#0a0f1c", borderBottom: "1px solid #1e2940",
        position: "sticky", top: 0, zIndex: 10, fontFamily: "'Inter',sans-serif",
      }}>
        {Object.entries(VIEWS).map(([k, v]) => {
          const on = view === k;
          return (
            <button key={k} onClick={() => setView(k)} style={{
              padding: "7px 13px", borderRadius: 10, cursor: "pointer", fontSize: 12.5, fontWeight: 700,
              border: on ? "1px solid #ffd54a" : "1px solid #1e2940",
              background: on ? "rgba(255,213,74,0.12)" : "#141c2e",
              color: on ? "#ffd54a" : "#8a99b8",
            }}>{v.label}</button>
          );
        })}
      </nav>
      {renderActive()}
    </div>
  );
}
