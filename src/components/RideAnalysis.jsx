import React, { useState, useMemo, useRef, useEffect } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Zap, Heart, Gauge, TrendingUp, MapPin, Cpu, ChevronLeft, ChevronRight, X, Mountain,
} from "lucide-react";
// Zdieľaný fyzikálny engine (pozri src/lib/physics.js)
import { airDensity, estimateCdA, calcPower, physicsTrust, fuse, hrZone } from "../lib/physics.js";
import { fetchElevations } from "../lib/elevation.js";

const CFG = { rider: 75, bike: 8.5, height: 180, crr: 0.0052, pos: "hoods", restHR: 60, maxHR: 190 };

// Syntetickú demo trasu ukotvíme do reálnej oblasti (Vysoké Tatry) – aby sa
// vykreslila na skutočnej mape. Normalizované 0..1 súradnice → lat/lon.
const CENTER = [49.1553, 20.2780];
const SPAN_LAT = 0.05;
const SPAN_LON = 0.085;
const geo = (p) => [CENTER[0] + (0.5 - p.y) * SPAN_LAT, CENTER[1] + (p.x - 0.5) * SPAN_LON];

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
    const phys = calcPower({ speed, slope, totalMass: CFG.rider + CFG.bike, cda, crr: CFG.crr, rho, wind: 2 / 3.6 });
    const hrP = Math.max(0, Math.round(2.6 * effortHR - 150));
    const trust = physicsTrust({ slope, speed });
    const { power, source } = fuse(phys, hrP, trust);
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

// Mapa sleduje aktuálny bod – pri scrube slidera / kliknutí sa naň
// plynule vycentruje, pričom si zachová priblíženie zvolené prstami.
// Prvé vykreslenie preskočíme, nech ostane úvodný „celá trasa“ pohľad.
function FollowMarker({ center }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    map.panTo(center, { animate: true, duration: 0.25 });
  }, [center[0], center[1]]);
  return null;
}

// Klik na mapu → nájde najbližší bod trasy a vyberie ho.
function MapClick({ latlngs, onPick }) {
  useMapEvents({
    click(e) {
      let best = 0, bd = Infinity;
      latlngs.forEach((q, i) => {
        const dx = q[0] - e.latlng.lat, dy = q[1] - e.latlng.lng;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i; }
      });
      onPick(best);
    },
  });
  return null;
}

export default function RideAnalysis({ imported, onClearImport }) {
  // Jednotná trasa: buď reálna importovaná (z GPX), alebo syntetické demo.
  const ride = useMemo(() => {
    if (imported) {
      return imported.track.map((t) => ({
        latlng: [t.lat, t.lon],
        dist: t.distKm,
        ele: t.ele,
        power: t.power,
        source: t.source,
        speed: t.speed,
        slope: t.slope,
        hr: t.hr,
        zone: t.hr != null ? hrZone(t.hr, CFG.restHR, CFG.maxHR) : null,
      }));
    }
    return buildRide(120).map((p) => ({ ...p, latlng: geo(p) }));
  }, [imported]);

  const [mode, setMode] = useState("power"); // 'power' | 'zone' – farbenie mapy
  const [metric, setMetric] = useState("power"); // 'power' | 'ele' – veľký graf pozdĺž trasy
  const [idx, setIdx] = useState(0);
  const [fetchedEle, setFetchedEle] = useState(null); // výšky dotiahnuté online
  const [eleStatus, setEleStatus] = useState("idle"); // idle | loading | error
  const graphRef = useRef();

  // Pri zmene zdroja (import ↔ demo) skoč na stred trasy a zahoď dotiahnuté výšky.
  useEffect(() => {
    setIdx(Math.floor(ride.length / 2));
    setFetchedEle(null);
    setEleStatus("idle");
  }, [ride]);

  const powers = ride.map((p) => p.power);
  const minP = Math.min(...powers), maxP = Math.max(...powers);
  const cIdx = Math.max(0, Math.min(idx, ride.length - 1));
  const cur = ride[cIdx];

  const hasZones = ride.some((p) => p.zone);
  const colorFor = (p) =>
    mode === "zone" && p.zone ? p.zone.color : powerColor(p.power, minP, maxP);

  // Reálne lat/lon súradnice trasy + ohraničenie pre fit mapy.
  const latlngs = useMemo(() => ride.map((p) => p.latlng), [ride]);
  const bounds = useMemo(() => L.latLngBounds(latlngs).pad(0.1), [latlngs]);

  // Os X grafov je škálovaná podľa prejdenej vzdialenosti (km), nie podľa
  // poradia bodov – takže rovnomerné delenie na osi zodpovedá reálnym metrom.
  const dist0 = ride[0].dist;
  const distSpan = (ride[ride.length - 1].dist - dist0) || 1;
  const xPct = (i) => ((ride[i].dist - dist0) / distSpan) * 100;
  // Najbližší bod trasy k relatívnej polohe (0..1) na osi vzdialenosti.
  const idxAtRel = (rel) => {
    const target = dist0 + Math.max(0, Math.min(1, rel)) * distSpan;
    let best = 0, bd = Infinity;
    for (let i = 0; i < ride.length; i++) {
      const d = Math.abs(ride[i].dist - target);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };

  // Profil prevýšenia: použijeme reálne výšky z GPX, inak ich dopočítame
  // integráciou sklonu po vzdialenosti (funguje aj pre demo trasu).
  const eles = useMemo(() => {
    if (fetchedEle && fetchedEle.length === ride.length) return fetchedEle;
    if (ride.every((p) => p.ele != null)) return ride.map((p) => p.ele);
    let e = 0;
    return ride.map((p, i) => {
      if (i > 0) e += (p.slope / 100) * (p.dist - ride[i - 1].dist) * 1000;
      return e;
    });
  }, [ride, fetchedEle]);
  const eMin = Math.min(...eles), eMax = Math.max(...eles);
  // Trasa bez výškových dát (alebo úplne rovná) → nemá zmysel kresliť profil.
  const hasElevation = eMax - eMin >= 1;
  // Celkové stúpanie: pri importe presne z analyzeRide, inak z profilu.
  const eleGain = imported
    ? imported.elevationGain
    : Math.round(eles.reduce((s, v, i) => s + Math.max(0, v - eles[i - 1] || 0), 0));
  // SVG dráha profilu (viewBox 0..100, x podľa vzdialenosti, 4 % okraj hore/dole).
  const eY = (v) => 96 - ((v - eMin) / (eMax - eMin || 1)) * 92;
  const eleLine = eles.map((v, i) => `${i ? "L" : "M"} ${xPct(i).toFixed(2)} ${eY(v).toFixed(2)}`).join(" ");
  const eleArea = `${eleLine} L 100 100 L 0 100 Z`;

  // Súhrn: pri importe z analyzeRide(), inak dopočítaný z demo trasy.
  const avgP = imported ? imported.avgPower : Math.round(powers.reduce((s, v) => s + v, 0) / powers.length);
  const maxPower = imported ? imported.maxPower : maxP;
  const totalDist = imported ? imported.distanceKm : ride[ride.length - 1].dist;

  // Scrub na grafe/profile → najbližší bod podľa vzdialenosti (rovnaká os km).
  const scrub = (e, ref) => {
    const rect = ref.current.getBoundingClientRect();
    setIdx(idxAtRel((e.clientX - rect.left) / rect.width));
  };
  const handleGraph = (e) => scrub(e, graphRef);

  // Dotiahne výšky terénu online (open-meteo) pre trasy bez <ele> v GPX.
  const loadElevation = async () => {
    setEleStatus("loading");
    try {
      const els = await fetchElevations(ride.map((p) => ({ lat: p.latlng[0], lon: p.latlng[1] })));
      if (els.some((v) => typeof v === "number")) {
        setFetchedEle(els);
        setEleStatus("idle");
      } else {
        setEleStatus("error");
      }
    } catch {
      setEleStatus("error");
    }
  };

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

        {/* Banner pri importovanej trase */}
        {imported && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
            background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.3)",
            borderRadius: 12, padding: "9px 12px",
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              📍 {imported.name}
            </span>
            <span style={{ fontSize: 10.5, color: "#6b7a99" }}>
              {imported.planned ? "plán · odhad" : imported.hasPower ? "merač" : "z fyziky"}
            </span>
            <button onClick={onClearImport} title="Zavrieť import (späť na demo)" style={{
              background: "none", border: "none", cursor: "pointer", color: "#8a99b8",
              display: "flex", alignItems: "center", padding: 2,
            }}>
              <X size={15} />
            </button>
          </div>
        )}

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

        {/* MAP (Leaflet + OpenStreetMap) */}
        <div style={{
          background: "#0d1424", border: "1px solid #1e2940",
          borderRadius: 18, padding: 6, marginBottom: 12, position: "relative",
        }}>
          <div style={{ height: 300, borderRadius: 14, overflow: "hidden" }}>
            <MapContainer
              key={imported ? imported.name : "demo"}
              bounds={bounds}
              style={{ height: "100%", width: "100%", background: "#0d1424" }}
              scrollWheelZoom
              attributionControl={false}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap'
              />
              <MapClick latlngs={latlngs} onPick={setIdx} />
              <FollowMarker center={latlngs[cIdx]} />

              {/* halo pod trasou */}
              <Polyline positions={latlngs} pathOptions={{ color: "#000", weight: 8, opacity: 0.35, lineCap: "round" }} />
              {/* farebné segmenty trasy */}
              {ride.slice(0, -1).map((p, i) => (
                <Polyline
                  key={i}
                  positions={[latlngs[i], latlngs[i + 1]]}
                  pathOptions={{ color: colorFor(p), weight: 5, lineCap: "round" }}
                />
              ))}
              {/* štart / cieľ */}
              <CircleMarker center={latlngs[0]} radius={7}
                pathOptions={{ color: "#0d1320", weight: 2, fillColor: "#4ade80", fillOpacity: 1 }} />
              <CircleMarker center={latlngs[latlngs.length - 1]} radius={7}
                pathOptions={{ color: "#0d1320", weight: 2, fillColor: "#ff5470", fillOpacity: 1 }} />
              {/* aktuálny bod */}
              <CircleMarker center={latlngs[cIdx]} radius={9}
                pathOptions={{ color: "#fff", weight: 3, fillColor: "#fff", fillOpacity: 1 }} />
            </MapContainer>
          </div>

          {/* floating tooltip */}
          <div style={{
            position: "absolute", top: 16, right: 16, zIndex: 1000,
            background: "rgba(13,20,36,0.92)", border: "1px solid #1e2940",
            borderRadius: 12, padding: "10px 13px", backdropFilter: "blur(8px)",
            minWidth: 96, pointerEvents: "none",
          }}>
            <div style={{ fontSize: 10, color: "#6b7a99", fontWeight: 600 }}>
              {cur.dist.toFixed(1)} km
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: colorFor(cur), lineHeight: 1.1 }}>
              {cur.power}<span style={{ fontSize: 13, marginLeft: 2 }}>W</span>
            </div>
            <div style={{ fontSize: 10.5, color: cur.zone ? cur.zone.color : "#6b7a99", fontWeight: 600 }}>
              {cur.zone ? cur.zone.label : "tep neznámy"}
            </div>
          </div>
        </div>

        {/* GRAPH (scrub) – prepínateľný: Výkon / Prevýšenie pozdĺž trasy */}
        <div style={{ background: "#101725", border: "1px solid #1e2940", borderRadius: 16, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#8a99b8", letterSpacing: 0.5 }}>
              {metric === "ele" ? "PREVÝŠENIE POZDĹŽ TRASY" : "VÝKON POZDĹŽ TRASY"}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              {[["power", "Výkon"], ["ele", "Prevýšenie"]].map(([k, t]) => {
                const on = metric === k;
                return (
                  <button key={k} onClick={() => setMetric(k)} style={{
                    padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 700,
                    border: on ? "1px solid #ffd54a" : "1px solid #1e2940",
                    background: on ? "rgba(255,213,74,0.12)" : "#141c2e",
                    color: on ? "#ffd54a" : "#8a99b8",
                  }}>{t}</button>
                );
              })}
            </div>
          </div>

          {metric === "ele" && !hasElevation ? (
            /* Prevýšenie bez dát – ponuka dopočtu online */
            <div style={{ minHeight: 90, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 6, padding: "6px 0" }}>
              <Mountain size={20} color="#6b7a99" style={{ opacity: 0.6 }} />
              <span style={{ fontSize: 12, color: "#8a99b8", fontWeight: 600 }}>Trasa neobsahuje výškové dáta</span>
              <span style={{ fontSize: 10.5, color: "#6b7a99", lineHeight: 1.4, maxWidth: 300 }}>
                Tvoje GPX nemá uložené výšky (&lt;ele&gt;). Môžem ich dopočítať z terénu online.
              </span>
              {eleStatus === "error" && (
                <span style={{ fontSize: 10.5, color: "#ff8a3d", fontWeight: 600 }}>
                  Výšky sa nepodarilo stiahnuť (sieť/limit). Skús znova.
                </span>
              )}
              <button onClick={loadElevation} disabled={eleStatus === "loading"} style={{
                marginTop: 2, background: eleStatus === "loading" ? "#1e2940" : "#ff8a3d",
                border: "none", borderRadius: 10, padding: "8px 14px",
                cursor: eleStatus === "loading" ? "default" : "pointer",
                fontSize: 12, fontWeight: 800, color: eleStatus === "loading" ? "#8a99b8" : "#0d1320",
              }}>
                {eleStatus === "loading" ? "Sťahujem výšky…" : "Dopočítať výšky online"}
              </button>
            </div>
          ) : (
            <>
              <div
                ref={graphRef}
                onMouseDown={handleGraph}
                onMouseMove={(e) => e.buttons === 1 && handleGraph(e)}
                style={{ position: "relative", height: 90, cursor: "pointer" }}
              >
                {metric === "ele" ? (
                  /* Profil prevýšenia celej trasy (plocha + krivka) */
                  <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
                    <defs>
                      <linearGradient id="eleFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ff8a3d" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#ff8a3d" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>
                    <path d={eleArea} fill="url(#eleFill)" />
                    <path d={eleLine} fill="none" stroke="#ff8a3d" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                  </svg>
                ) : (
                  /* Stĺpce výkonu so šírkou podľa vzdialenosti úseku */
                  <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: "block" }}>
                    {ride.slice(0, -1).map((p, i) => {
                      const h = Math.max(4, ((p.power - minP) / (maxP - minP || 1)) * 100);
                      const x = xPct(i);
                      return (
                        <rect key={i}
                          x={x} y={100 - h} width={Math.max(0.01, xPct(i + 1) - x)} height={h}
                          fill={i === cIdx ? "#fff" : colorFor(p)}
                          opacity={i === cIdx ? 1 : 0.85}
                        />
                      );
                    })}
                  </svg>
                )}
                {/* position line (podľa vzdialenosti) */}
                <div style={{
                  position: "absolute", top: 0, bottom: 0,
                  left: `${xPct(cIdx)}%`,
                  width: 2, background: "#fff", pointerEvents: "none",
                }} />
                {/* bod na výškovej krivke */}
                {metric === "ele" && (
                  <div style={{
                    position: "absolute", left: `${xPct(cIdx)}%`, top: `${eY(eles[cIdx])}%`,
                    width: 9, height: 9, borderRadius: "50%", background: "#fff",
                    border: "2px solid #ff8a3d", transform: "translate(-50%,-50%)", pointerEvents: "none",
                  }} />
                )}
              </div>
              {/* spodný riadok: pri výkone os v km, pri prevýšení rozsah + stúpanie */}
              {metric === "ele" ? (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "#6b7a99" }}>
                  <span>{Math.round(eMin)} m</span>
                  <span style={{ color: "#ff8a3d", fontWeight: 700 }}>{Math.round(eles[cIdx])} m · ↑ {eleGain} m</span>
                  <span>{Math.round(eMax)} m</span>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "#6b7a99" }}>
                  <span>0 km</span>
                  <span>{(dist0 + distSpan / 2).toFixed(1)} km</span>
                  <span>{(dist0 + distSpan).toFixed(1)} km</span>
                </div>
              )}
            </>
          )}
          {/* slider for fine control */}
          <input
            type="range" min={0} max={ride.length - 1} value={cIdx}
            onChange={(e) => setIdx(parseInt(e.target.value))}
            style={{ width: "100%", marginTop: 10, accentColor: "#ff8a3d", cursor: "pointer" }}
          />
        </div>

        {/* DETAIL at current point */}
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <Stat icon={Zap} label="Výkon" value={cur.power} unit="W" color={colorFor(cur)} />
          <Stat icon={Heart} label="Tep" value={cur.hr != null ? cur.hr : "—"} unit={cur.hr != null ? "bpm" : ""} color="#ff5470" />
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
              bod {cIdx + 1} / {ride.length}
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
          ) : hasZones ? (
            [1, 2, 3, 4, 5].map((z) => {
              const c = hrZone(CFG.restHR + (CFG.maxHR - CFG.restHR) * (0.5 + z * 0.08)).color;
              return <span key={z} style={{ fontSize: 10, fontWeight: 700, color: "#0d1320", background: c, padding: "2px 8px", borderRadius: 6 }}>Z{z}</span>;
            })
          ) : (
            <span style={{ fontSize: 10.5, color: "#6b7a99" }}>GPX bez tepu – farbím podľa výkonu</span>
          )}
        </div>

        <p style={{ fontSize: 11, color: "#5d6b88", textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
          {imported
            ? imported.planned
              ? "Plánovaná trasa z tvojho GPX – ešte neodjazdená. Výkon je odhad pri ~22 km/h (spomalený do kopca, rýchlejší z kopca). Klikni na mapu alebo potiahni po grafe. Podklad: OpenStreetMap."
              : "Reálna trasa z tvojho GPX. Klikni na mapu alebo potiahni po grafe – uvidíš výkon, tep a sklon v danom mieste. Podklad: OpenStreetMap."
            : "Ukážková jazda. Klikni kdekoľvek na mapu alebo potiahni po grafe – a importom vlastného GPX (záložka Import) sem dostaneš svoju trasu. Podklad: OpenStreetMap."}
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
