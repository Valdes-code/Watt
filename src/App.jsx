import React, { useState } from "react";
import CycloWattPreview from "./components/CycloWattPreview.jsx";
import RideAnalysis from "./components/RideAnalysis.jsx";
import GpxImport from "./components/GpxImport.jsx";
import PoseDetectionDemo from "./components/PoseDetectionDemo.jsx";

const VIEWS = {
  preview: { label: "Appka", Component: CycloWattPreview },
  ride: { label: "Analýza jazdy", Component: RideAnalysis },
  gpx: { label: "Import GPX", Component: GpxImport },
  pose: { label: "Detekcia polohy", Component: PoseDetectionDemo },
};

export default function App() {
  const [view, setView] = useState("gpx");
  const Active = VIEWS[view].Component;

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
      <Active />
    </div>
  );
}
