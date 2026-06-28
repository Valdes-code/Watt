import React, { useState, useRef } from "react";
import { MapPin, Clock, X, Upload, Download, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { importGpx } from "../lib/gpx.js";
import { loadHistory, saveHistory, removeFromHistory, loadHistoryMax, importHistoryEntries } from "../lib/history.js";

const pad2 = (n) => String(n).padStart(2, "0");

// Typ trasy z prípony názvu súboru (gpx, fit, tcx…). Bez prípony → „gpx".
const fileType = (name) => {
  const m = /\.([a-z0-9]+)$/i.exec(name || "");
  return (m ? m[1] : "gpx").toLowerCase();
};

const SORTS = [
  { key: "date", label: "Dátum" },
  { key: "dist", label: "Vzdialenosť" },
  { key: "type", label: "Typ" },
];

// Záložka „História jázd" – zoznam všetkých uložených trás (zdieľané s Import GPX).
// Klik na jazdu ju otvorí v „Analýza jazdy"; krížik ju odstráni z histórie.
export default function RideHistory({ onOpen, activeGpx, onGoImport }) {
  const [history, setHistory] = useState(loadHistory);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const [sort, setSort] = useState("date");
  const [dir, setDir] = useState("desc"); // desc = od poslednej/najväčšej, asc = naopak
  const fileRef = useRef(null);

  // Export celej histórie do JSON súboru (záloha do zariadenia).
  const exportAll = () => {
    const data = JSON.stringify({ app: "watt", kind: "ride-history", version: 1, rides: loadHistory() }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const d = new Date();
    a.href = url;
    a.download = `watt-historia-jazd-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Import zálohy: zlúči s aktuálnou históriou (dedup, oreže na limit).
  const onImportFile = (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = ""; // umožní znova vybrať ten istý súbor
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const rides = Array.isArray(parsed) ? parsed : parsed.rides;
        const before = loadHistory().length;
        const next = importHistoryEntries(rides);
        setHistory(next);
        setError(null);
        const added = next.length - before;
        setNote(added > 0 ? `Pridaných ${added} ${added === 1 ? "jazda" : added < 5 ? "jazdy" : "jázd"}.` : "Žiadne nové jazdy (už ich máš v histórii).");
      } catch (e) {
        setNote(null);
        setError(`Import zálohy zlyhal: ${e.message}.`);
      }
    };
    reader.readAsText(file);
  };

  // Klik: neaktívny štítok → prepne kritérium (smer „desc"); aktívny → otočí smer.
  const onSort = (key) => {
    if (key === sort) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSort(key); setDir("desc"); }
  };

  // Zoradenie len pre zobrazenie (uložené poradie ostáva = poradie importov).
  const mul = dir === "asc" ? -1 : 1;
  const sorted = [...history].sort((a, b) => {
    if (sort === "dist") return (b.dist - a.dist) * mul;    // desc: najdlhšie najprv
    if (sort === "type") {
      const t = fileType(a.name).localeCompare(fileType(b.name));
      return (t !== 0 ? t : b.ts - a.ts) * mul;             // desc: a→z, v rámci typu najnovšie
    }
    return (b.ts - a.ts) * mul;                             // desc: najnovšie (od poslednej) najprv
  });

  const open = (e) => {
    try {
      const ride = importGpx(e.gpx);
      onOpen?.(e.name, ride, e.gpx);
    } catch (err) {
      setError(`„${e.name}" sa nepodarilo načítať: ${err.message}`);
    }
  };
  const remove = (id) => setHistory(removeFromHistory(id));
  const clearAll = () => { setHistory([]); saveHistory([]); };

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 50% 0%, var(--bg-grad-1), var(--bg-grad-2) 60%)", padding: 22, fontFamily: "'Inter',sans-serif", display: "flex", justifyContent: "center" }}>
      <div style={{ width: 400, maxWidth: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: "var(--text)" }}>História jázd</div>
          {history.length > 0 && (
            <span onClick={clearAll} style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", cursor: "pointer" }}>Vymazať všetko</span>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 6, marginBottom: 20, lineHeight: 1.5 }}>
          {history.length > 0
            ? `Klikni na jazdu pre otvorenie v Analýze. Ukladá sa posledných ${loadHistoryMax()} trás (zmeníš v Profile).`
            : "Tu sa zbierajú tvoje importované jazdy."}
        </div>

        {error && (
          <div style={{ background: "#ff54701a", border: "1px solid #ff547055", borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 12, color: "#ff5470", fontWeight: 600 }}>{error}</div>
        )}
        {note && (
          <div style={{ background: "#4ade801a", border: "1px solid #4ade8055", borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 12, color: "#4ade80", fontWeight: 600 }}>{note}</div>
        )}

        {/* Záloha: export/import histórie jázd */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button onClick={exportAll} disabled={history.length === 0} title={history.length === 0 ? "Najprv pridaj nejaké jazdy" : "Stiahnuť zálohu (.json)"} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "10px 8px", borderRadius: 11, fontSize: 12.5, fontWeight: 700,
            border: "1px solid var(--border)", background: "var(--surface)",
            color: history.length === 0 ? "var(--text-4)" : "var(--text-1)",
            cursor: history.length === 0 ? "default" : "pointer", opacity: history.length === 0 ? 0.6 : 1,
          }}>
            <Download size={15} /> Export
          </button>
          <button onClick={() => fileRef.current?.click()} title="Načítať zálohu (.json)" style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "10px 8px", borderRadius: 11, fontSize: 12.5, fontWeight: 700,
            border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-1)", cursor: "pointer",
          }}>
            <Upload size={15} /> Import
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={onImportFile} style={{ display: "none" }} />
        </div>

        {history.length > 1 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: 0.5, marginBottom: 7 }}>ZORADIŤ PODĽA</div>
            <div style={{ display: "flex", gap: 7 }}>
              {SORTS.map(({ key, label }) => {
                const on = sort === key;
                const Arrow = dir === "asc" ? ArrowUp : ArrowDown;
                return (
                  <button key={key} onClick={() => onSort(key)} title={on ? "Klikni pre otočenie poradia" : undefined} style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                    padding: "8px 6px", borderRadius: 10, cursor: "pointer", fontSize: 11.5, fontWeight: 700,
                    border: on ? "1px solid #ffd54a" : "1px solid var(--border)",
                    background: on ? "rgba(255,213,74,0.12)" : "var(--surface)",
                    color: on ? "#ffd54a" : "var(--text-2)",
                  }}>{label}{on && <Arrow size={13} />}</button>
                );
              })}
            </div>
          </div>
        )}

        {history.length === 0 ? (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 22, textAlign: "center" }}>
            <Clock size={30} color="var(--text-3)" style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 600 }}>Zatiaľ žiadne jazdy</div>
            <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 6, lineHeight: 1.5, marginBottom: 14 }}>
              Naimportuj GPX súbor a objaví sa tu.
            </div>
            <button onClick={() => onGoImport?.()} style={{
              display: "inline-flex", alignItems: "center", gap: 7, background: "#ffd54a", border: "none",
              borderRadius: 12, padding: "11px 18px", cursor: "pointer", fontSize: 13, fontWeight: 800, color: "#0d1320",
            }}>
              <Upload size={15} /> Importovať jazdu
            </button>
          </div>
        ) : (
          sorted.map((e) => {
            const active = e.gpx === activeGpx;
            return (
              <div key={e.id} onClick={() => open(e)} title={active ? "Práve zobrazená v Analýze jazdy" : undefined} style={{
                display: "flex", alignItems: "center", gap: 12,
                background: active ? "rgba(255,213,74,0.08)" : "var(--surface)",
                border: active ? "1px solid #ffd54a" : "1px solid var(--border)",
                borderRadius: 12, padding: 13, marginBottom: 10, cursor: "pointer",
              }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: active ? "rgba(255,213,74,0.15)" : "#7fb0ff14", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Clock size={17} color={active ? "#ffd54a" : "#7fb0ff"} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                    {active && (
                      <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.4, color: "#ffd54a", background: "rgba(255,213,74,0.15)", borderRadius: 6, padding: "2px 6px", whiteSpace: "nowrap", flexShrink: 0 }}>AKTÍVNA</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3, display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                    <span>{new Date(e.ts).toLocaleString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><MapPin size={11} color="#7fb0ff" />{e.dist.toFixed(1)} km</span>
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.4, color: "var(--text-2)", background: "var(--surface-3)", border: "1px solid var(--border)", borderRadius: 5, padding: "1px 5px", textTransform: "uppercase" }}>{fileType(e.name)}</span>
                    {e.planned && <span style={{ color: "#ffd54a", fontWeight: 700 }}>plán</span>}
                  </div>
                </div>
                <ChevronRight size={16} color="var(--text-3)" style={{ flexShrink: 0 }} />
                <button
                  onClick={(ev) => { ev.stopPropagation(); remove(e.id); }}
                  title="Odstrániť z histórie"
                  style={{ background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer", padding: 4, display: "flex", flexShrink: 0 }}
                >
                  <X size={15} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
