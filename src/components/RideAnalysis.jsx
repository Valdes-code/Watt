import React, { useState, useMemo, useRef, useEffect } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Zap, Heart, Gauge, TrendingUp, MapPin, Cpu, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Mountain, Repeat,
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

// Plynulé sledovanie bodu: keď je mapa priblížená, držíme bod v strede a mapa
// sa posúva po malých krokoch (bod ide rovnomerne) → dlaždice nabiehajú postupne
// na nábežnej hrane namiesto skokových prázdnych miest = menej preblikávania.
// Posúvame len pri zmene bodu (slajder/scrub/klik), nie pri ručnom posune mapy.
// Pri pohľade na celú trasu necentrujeme (mapa stojí).
function FollowMarker({ center, routeBounds }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (map.getBounds().contains(routeBounds)) return;   // celá trasa vidno → necentruj
    map.panTo(center, { animate: false });               // drž bod v strede, plynulý posun
  }, [center[0], center[1]]);
  return null;
}

// Sleduje aktuálny výrez mapy (zoom aj posun), aby sa detailné okno grafov
// prispôsobilo viditeľnému úseku trasy. 'moveend' pokrýva všetky pohyby; slučka
// nehrozí, lebo výrez už neprepisuje vybraný bod (žiadne dorovnávanie do okna).
function MapViewport({ onChange }) {
  const map = useMapEvents({
    moveend() { onChange(map.getBounds()); },
  });
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

// Ikonky (SVG) pre tlačidlo celej obrazovky – ladia s Leaflet ovládačmi (čierne na bielom).
const EXPAND_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';
const SHRINK_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>';

// Tlačidlo „mapa na celú obrazovku" – Leaflet ovládač v topleft, ktorý sa
// automaticky zaradí POD zoom +/−.
function FullscreenControl({ full, setFull }) {
  const map = useMap();
  useEffect(() => {
    const ctl = L.control({ position: "topleft" });
    ctl.onAdd = () => {
      const div = L.DomUtil.create("div", "leaflet-bar");
      const a = L.DomUtil.create("a", "", div);
      a.href = "#";
      a.title = full ? "Zmenšiť mapu" : "Mapa na celú obrazovku";
      a.style.cssText = "display:flex;align-items:center;justify-content:center;";
      a.innerHTML = full ? SHRINK_SVG : EXPAND_SVG;
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.on(a, "click", (e) => { L.DomEvent.preventDefault(e); setFull((v) => !v); });
      return div;
    };
    ctl.addTo(map);
    return () => ctl.remove();
  }, [map, full, setFull]);
  return null;
}

// Po zmene veľkosti mapy (vstup/výstup z celej obrazovky) oznám Leafletu nový rozmer.
function MapResizer({ trigger }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 60);
    return () => clearTimeout(t);
  }, [trigger, map]);
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
  const [sliderVal, setSliderVal] = useState(0); // poloha thumbu (sleduje prst voľne)
  const [tipIdx, setTipIdx] = useState(0); // ktorá hodnota sa ukazuje v rohu mapy (len plán)
  const [boxPos, setBoxPos] = useState(null);  // {x,y} px štítku v mape (null = vpravo hore)
  const [docked, setDocked] = useState(null);  // null | 'left'|'right'|'top'|'bottom' (zrolovaný k okraju)
  const [mapFull, setMapFull] = useState(false); // mapa na celú obrazovku
  const mapWrapRef = useRef(null);   // obal mapy (hranice pre ťahanie)
  const boxRef = useRef(null);       // element štítku
  const dragRef = useRef(null);      // stav ťahania
  const livePosRef = useRef(null);   // aktuálna poloha štítku počas ťahania
  const preDockRef = useRef(null);   // poloha pred zrolovaním (na obnovenie)
  const tileRef = useRef(null);      // Leaflet TileLayer (na dynamický keepBuffer)
  const [fetchedEle, setFetchedEle] = useState(null); // výšky dotiahnuté online
  const [eleStatus, setEleStatus] = useState("idle"); // idle | loading | error
  const [mapBounds, setMapBounds] = useState(null); // výrez mapy (pri priblížení)
  const graphRef = useRef();
  // „Glide" posúvanie bodu konštantnou rýchlosťou v KILOMETROCH po trase – takže
  // bod ide po mape rovnomerne aj keď sú GPS body nerovnomerne husté. Slajder
  // nastaví cieľ, bod sa k nemu plynule (obmedzene rýchlo) dostane. Klik do mapy
  // / scrub grafu / šípky skáču priamo (bez obmedzenia).
  const distPosRef = useRef(0);    // plynulá pozícia bodu po trase [km]
  const targetDistRef = useRef(0); // cieľová vzdialenosť [km]
  const targetIdxRef = useRef(0);  // cieľový index (presné dorazenie)
  const rafRef = useRef(null);
  const lastTsRef = useRef(0);
  const lastInputRef = useRef(0);  // čas posledného pohybu slajdera [ms]

  // Pri zmene zdroja (import ↔ demo) skoč na stred trasy, zahoď dotiahnuté výšky
  // aj výrez mapy (graf zobrazí celú trasu).
  useEffect(() => {
    const mid = Math.floor(ride.length / 2);
    distPosRef.current = ride[mid].dist; targetDistRef.current = ride[mid].dist;
    targetIdxRef.current = mid; // zruš rozbehnutý glide
    setIdx(mid); setSliderVal(mid);
    // Pri pláne začni na „vzdialenosť do cieľa" (index 2) – je to jediná živá
    // hodnota, ktorá sa hneď mení s posunom bodu, takže používateľ rovno vidí,
    // že roh reaguje na polohu (celkové súčty #1/#2 sú zámerne konštantné).
    setTipIdx(imported?.planned ? 2 : 0);
    setFetchedEle(null);
    setEleStatus("idle");
    setMapBounds(null);
    setBoxPos(null); setDocked(null); // štítok späť do pravého horného rohu
  }, [ride, imported]);

  // Na celej obrazovke je mapa väčšia → drž viac dlaždíc okolo výrezu (menej
  // preblikávania). keepBuffer nie je reaktívny prop, tak ho nastavíme na vrstve.
  useEffect(() => {
    const tl = tileRef.current;
    if (tl) tl.options.keepBuffer = mapFull ? 24 : 8;
  }, [mapFull]);

  const powers = ride.map((p) => p.power);
  const minP = Math.min(...powers), maxP = Math.max(...powers);
  const cIdx = Math.max(0, Math.min(idx, ride.length - 1));
  const cur = ride[cIdx];

  // Tempo „glide" v KILOMETROCH za sekundu – konštantná rýchlosť po trase, takže
  // bod ide po mape rovnomerne. Nižšie = pokojnejšie.
  const GLIDE_KMS = 7;
  // Najbližší index k danej vzdialenosti (ride[i].dist je rastúce → bin. hľadanie).
  const idxForDist = (d) => {
    const last = ride.length - 1;
    if (d <= ride[0].dist) return 0;
    if (d >= ride[last].dist) return last;
    let lo = 0, hi = last;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (ride[m].dist < d) lo = m + 1; else hi = m;
    }
    return (lo > 0 && d - ride[lo - 1].dist < ride[lo].dist - d) ? lo - 1 : lo;
  };
  // Keď slajder dlhšie ako STOP_MS nepohol, bod ZASTAVÍME tam, kde je (žiadny
  // dobeh do cieľa) – bod sa hýbe len kým hýbeš slajderom.
  const STOP_MS = 90;
  const stepGlide = (ts) => {
    const dt = Math.min(80, ts - lastTsRef.current);
    lastTsRef.current = ts;
    if (ts - lastInputRef.current > STOP_MS) {   // slajder stojí → zastav bez dobehu
      targetDistRef.current = distPosRef.current; rafRef.current = null; return;
    }
    const t = targetDistRef.current;
    const diff = t - distPosRef.current;
    const stepKm = (GLIDE_KMS * dt) / 1000;
    if (Math.abs(diff) <= stepKm) {        // dorazili sme na cieľ
      distPosRef.current = t; setIdx(targetIdxRef.current); rafRef.current = null; return;
    }
    distPosRef.current += Math.sign(diff) * stepKm;
    setIdx(idxForDist(distPosRef.current));
    rafRef.current = requestAnimationFrame(stepGlide);
  };
  // Slajder: thumb ide hneď za prstom (voľný), bod ho dobieha rovnomerným tempom.
  const glideTo = (v) => {
    const idx = Math.max(0, Math.min(ride.length - 1, Math.round(v)));
    setSliderVal(idx);                          // thumb sleduje prst priamo
    targetIdxRef.current = idx;
    targetDistRef.current = ride[idx].dist;
    lastInputRef.current = performance.now();   // slajder sa práve pohol
    if (rafRef.current == null) {
      lastTsRef.current = performance.now();
      rafRef.current = requestAnimationFrame(stepGlide);
    }
  };
  // Pustenie slajdera → zastav bod tam, kde je (žiadny dobeh) a zarovnaj naň thumb.
  const stopGlide = () => {
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    targetDistRef.current = distPosRef.current;
    setSliderVal(idxForDist(distPosRef.current));
  };
  // Priamy skok (klik do mapy, scrub grafu, šípky) – bez obmedzenia rýchlosti.
  const jumpTo = (v) => {
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    const nv = Math.max(0, Math.min(ride.length - 1, Math.round(v)));
    distPosRef.current = ride[nv].dist; targetDistRef.current = ride[nv].dist;
    targetIdxRef.current = nv; setIdx(nv); setSliderVal(nv);
  };
  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); }, []);

  const hasZones = ride.some((p) => p.zone);
  const colorFor = (p) =>
    mode === "zone" && p.zone ? p.zone.color : powerColor(p.power, minP, maxP);

  // Reálne lat/lon súradnice trasy + ohraničenie pre fit mapy.
  const latlngs = useMemo(() => ride.map((p) => p.latlng), [ride]);
  const bounds = useMemo(() => L.latLngBounds(latlngs).pad(0.1), [latlngs]);

  // Detailné okno grafov = úsek trasy, ktorý je práve viditeľný na mape. Keďže
  // mapa sleduje aktuálny bod (FollowMarker) a 'moveend' aktualizuje výrez, okno
  // sa popri posune bodu „posúva" (scrolluje) – aj profil prevýšenia. Slajder
  // pritom ovláda CELÚ trasu, takže sa dá prejsť od začiatku po koniec aj pri
  // veľkom priblížení (bod dôjde na okraj → mapa sa posunie → okno ide ďalej).
  const [winStart, winEnd] = useMemo(() => {
    if (!mapBounds) return [0, ride.length - 1];
    let lo = -1, hi = -1;
    for (let i = 0; i < ride.length; i++) {
      if (mapBounds.contains(ride[i].latlng)) { if (lo < 0) lo = i; hi = i; }
    }
    if (lo < 0) return [0, ride.length - 1];          // nič viditeľné → celá trasa
    if (lo === hi) {                                   // len jeden bod → rozšír o suseda
      lo = Math.max(0, lo - 1);
      hi = Math.min(ride.length - 1, hi + 1);
    }
    return [lo, hi];
  }, [mapBounds, ride]);

  // Pozn.: vybraný bod zámerne NEdorovnávame do viditeľného okna pri posune/zoome
  // mapy – inak by sa pri ručnom posune bod „prilepil" k okraju a mapa by sa naň
  // znova vycentrovala. Bod mení len slajder/scrub/klik; mapu možno voľne posúvať.

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
  // Existencia výškových dát sa posudzuje z celej trasy (nie z výrezu).
  const hasElevation = Math.max(...eles) - Math.min(...eles) >= 1;

  // Celkové stúpanie celej trasy a stúpanie zostávajúce od aktuálneho bodu do cieľa
  // (súčet kladných prírastkov výšky). Slúži pre prepínateľný štítok v rohu mapy.
  const totalEleGain = useMemo(() => {
    let g = 0;
    for (let i = 1; i < eles.length; i++) g += Math.max(0, eles[i] - eles[i - 1]);
    return Math.round(g);
  }, [eles]);
  const remEleGain = useMemo(() => {
    let g = 0;
    for (let i = cIdx + 1; i < eles.length; i++) g += Math.max(0, eles[i] - eles[i - 1]);
    return Math.round(g);
  }, [eles, cIdx]);

  // Os X grafov škálovaná podľa vzdialenosti v rámci viditeľného okna.
  const wDist0 = ride[winStart].dist;
  const wSpan = (ride[winEnd].dist - wDist0) || 1;
  const xPct = (i) => ((ride[i].dist - wDist0) / wSpan) * 100;
  // Najbližší bod (v okne) k relatívnej polohe (0..1) na osi vzdialenosti.
  const idxAtRel = (rel) => {
    const target = wDist0 + Math.max(0, Math.min(1, rel)) * wSpan;
    let best = winStart, bd = Infinity;
    for (let i = winStart; i <= winEnd; i++) {
      const d = Math.abs(ride[i].dist - target);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };

  // Y-os výškového profilu sa autoškáluje na viditeľné okno (lepší detail).
  const winEles = eles.slice(winStart, winEnd + 1);
  const eMin = Math.min(...winEles), eMax = Math.max(...winEles);
  const eleGain = Math.round(winEles.reduce((s, v, i) => s + Math.max(0, v - winEles[i - 1] || 0), 0));
  const eY = (v) => 96 - ((v - eMin) / (eMax - eMin || 1)) * 92;
  const eleLine = winEles
    .map((v, k) => `${k ? "L" : "M"} ${xPct(winStart + k).toFixed(2)} ${eY(v).toFixed(2)}`)
    .join(" ");
  const eleArea = `${eleLine} L 100 100 L 0 100 Z`;

  // Súhrn: pri importe z analyzeRide(), inak dopočítaný z demo trasy.
  const avgP = imported ? imported.avgPower : Math.round(powers.reduce((s, v) => s + v, 0) / powers.length);
  const maxPower = imported ? imported.maxPower : maxP;
  const totalDist = imported ? imported.distanceKm : ride[ride.length - 1].dist;

  // Plánovaná (ešte neodjazdená) trasa: výkon je len odhad, tak ho v detaile
  // skryjeme a namiesto neho ukážeme vzdialenosť z aktuálneho bodu do cieľa.
  const planned = !!imported?.planned;
  const distToFinish = Math.max(0, totalDist - cur.dist);

  // Prepínateľné hodnoty štítku v rohu mapy (len plánovaná trasa). Klik = ďalšia.
  const ele = (v) => (hasElevation ? { value: String(v), unit: "m" } : { value: "—", unit: "" });
  const tips = [
    { label: "celková dĺžka trate", value: totalDist.toFixed(1), unit: "km", color: "#7fb0ff" },
    { label: "celkové prevýšenie trate", ...ele(totalEleGain), color: "#ff8a3d" },
    { label: "vzdialenosť do cieľa", value: distToFinish.toFixed(1), unit: "km", color: "#7fb0ff" },
    { label: "prevýšenie do cieľa", ...ele(remEleGain), color: "#ff8a3d" },
  ];
  const tip = tips[tipIdx % tips.length];

  // ── Ťahateľný štítok v rohu mapy: drž a ťahaj po mape; keď ho pretiahneš za
  // okraj, zroluje sa do tej strany (malé uško, klikom ho zase vytiahneš). ──
  const DOCK_OVER = 26; // o koľko px musí presahovať za okraj, aby sa zrolovalo
  const onBoxDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    const wrap = mapWrapRef.current?.getBoundingClientRect();
    const b = boxRef.current?.getBoundingClientRect();
    if (!wrap || !b) return;
    dragRef.current = { px: e.clientX, py: e.clientY, baseX: b.left - wrap.left, baseY: b.top - wrap.top, w: b.width, h: b.height, moved: false };
    livePosRef.current = { x: b.left - wrap.left, y: b.top - wrap.top };
    boxRef.current.setPointerCapture?.(e.pointerId);
    e.stopPropagation();
  };
  const onBoxMove = (e) => {
    const d = dragRef.current; if (!d) return;
    const dx = e.clientX - d.px, dy = e.clientY - d.py;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
    const pos = { x: d.baseX + dx, y: d.baseY + dy };
    livePosRef.current = pos; setBoxPos(pos);
    e.stopPropagation();
  };
  const onBoxUp = (e) => {
    const d = dragRef.current; if (!d) return;
    dragRef.current = null;
    boxRef.current?.releasePointerCapture?.(e.pointerId);
    if (!d.moved) {                              // klik (nie ťahanie) → prepni hodnotu (len plán)
      if (planned) setTipIdx((i) => (i + 1) % tips.length);
      return;
    }
    const wrap = mapWrapRef.current.getBoundingClientRect();
    const W = wrap.width, H = wrap.height;
    const { x, y } = livePosRef.current;
    const over = { left: -x, right: x + d.w - W, top: -y, bottom: y + d.h - H };
    const side = Object.keys(over).reduce((a, b) => (over[b] > over[a] ? b : a), "left");
    if (over[side] > DOCK_OVER) {                // pretiahnuté za okraj → zroluj do tej strany
      preDockRef.current = { x: Math.max(8, Math.min(x, W - d.w - 8)), y: Math.max(8, Math.min(y, H - d.h - 8)) };
      setDocked(side);
    } else {                                     // inak nechaj v okne (oriež do hraníc)
      setBoxPos({ x: Math.max(0, Math.min(x, W - d.w)), y: Math.max(0, Math.min(y, H - d.h)) });
    }
    e.stopPropagation();
  };
  const undock = () => { setDocked(null); setBoxPos(preDockRef.current); };

  // Scrub na grafe/profile → najbližší bod podľa vzdialenosti (rovnaká os km).
  const scrub = (e, ref) => {
    const rect = ref.current.getBoundingClientRect();
    jumpTo(idxAtRel((e.clientX - rect.left) / rect.width));
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
      background: "radial-gradient(circle at 50% -10%, var(--bg-grad-1) 0%, var(--bg-grad-2) 55%, var(--bg-app) 100%)",
      padding: 20, fontFamily: "'Inter',sans-serif", display: "flex", justifyContent: "center",
    }}>
      <div style={{ width: 400, maxWidth: "100%" }}>
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
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)" }}>Analýza jazdy</div>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
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
            <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>
              {imported.planned ? "plán · odhad" : imported.hasPower ? "merač" : "z fyziky"}
            </span>
            <button onClick={onClearImport} title="Vybrať inú jazdu" style={{
              display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer",
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 9,
              padding: "5px 10px", fontSize: 11.5, fontWeight: 700, color: "var(--text-1)", flexShrink: 0,
            }}>
              <Repeat size={13} /> Vybrať inú
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
                border: on ? "1px solid #ffd54a" : "1px solid var(--border)",
                background: on ? "rgba(255,213,74,0.12)" : "var(--surface-3)",
                color: on ? "#ffd54a" : "var(--text-2)",
              }}>{m.t}</button>
            );
          })}
        </div>

        {/* MAP (Leaflet + OpenStreetMap) */}
        <div ref={mapWrapRef} style={{
          background: "var(--surface-2)",
          ...(mapFull
            ? { position: "fixed", inset: 0, zIndex: 2000, padding: 0, margin: 0, borderRadius: 0, border: "none" }
            : { position: "relative", border: "1px solid var(--border)", borderRadius: 18, padding: 6, marginBottom: 12 }),
        }}>
          <div style={{ height: mapFull ? "100%" : 300, borderRadius: mapFull ? 0 : 14, overflow: "hidden" }}>
            <MapContainer
              key={imported ? imported.name : "demo"}
              bounds={bounds}
              maxZoom={17}
              style={{ height: "100%", width: "100%", background: "var(--surface-2)" }}
              scrollWheelZoom
              attributionControl={false}
            >
              {/* Carto Voyager – rýchle CDN dlaždice (menej preblikávania) s
                  detailnými ulicami. Alternatívy: .../dark_all/... (tmavá, ladí
                  s témou) alebo .../light_all/... (svetlá minimalistická). */}
              <TileLayer
                ref={tileRef}
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
                attribution='&copy; OpenStreetMap &copy; CARTO'
                maxZoom={20}
                keepBuffer={8}
                updateWhenIdle={false}
              />
              <FullscreenControl full={mapFull} setFull={setMapFull} />
              <MapResizer trigger={mapFull} />
              <MapClick latlngs={latlngs} onPick={jumpTo} />
              <MapViewport onChange={setMapBounds} />
              <FollowMarker center={latlngs[cIdx]} routeBounds={bounds} />

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
                pathOptions={{ color: "#0d1320", weight: 3, fillColor: "#7fb0ff", fillOpacity: 1 }} />
            </MapContainer>
          </div>

          {/* ŤAHATEĽNÝ štítok: drž a ťahaj po mape; za okraj sa zroluje do tej strany */}
          {docked ? (
            <button
              onClick={undock}
              title="Vytiahnuť štítok"
              style={{
                position: "absolute", zIndex: 1000, padding: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--glass)", border: "1px solid var(--border)",
                backdropFilter: "blur(8px)", color: "var(--text-2)", cursor: "pointer",
                width: docked === "left" || docked === "right" ? 22 : 40,
                height: docked === "left" || docked === "right" ? 40 : 22,
                ...(docked === "left" ? { left: 0, top: "50%", transform: "translateY(-50%)", borderRadius: "0 10px 10px 0" }
                  : docked === "right" ? { right: 0, top: "50%", transform: "translateY(-50%)", borderRadius: "10px 0 0 10px" }
                  : docked === "top" ? { top: 0, left: "50%", transform: "translateX(-50%)", borderRadius: "0 0 10px 10px" }
                  : { bottom: 0, left: "50%", transform: "translateX(-50%)", borderRadius: "10px 10px 0 0" }),
              }}
            >
              {docked === "left" ? <ChevronRight size={15} /> : docked === "right" ? <ChevronLeft size={15} />
                : docked === "top" ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </button>
          ) : (
            <div
              ref={boxRef}
              onPointerDown={onBoxDown}
              onPointerMove={onBoxMove}
              onPointerUp={onBoxUp}
              onPointerCancel={onBoxUp}
              title={planned ? "Ťahaj po mape · klik = ďalšia hodnota" : "Ťahaj po mape"}
              style={{
                position: "absolute", zIndex: 1000, touchAction: "none",
                ...(boxPos ? { left: boxPos.x, top: boxPos.y } : { right: 16, top: 16 }),
                background: "var(--glass)", border: "1px solid var(--border)",
                borderRadius: 12, padding: "10px 13px", backdropFilter: "blur(8px)",
                minWidth: 96, userSelect: "none", cursor: "grab",
              }}
            >
              {planned ? (
                <>
                  <div style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 600 }}>
                    bod {cur.dist.toFixed(1)} km
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: tip.color, lineHeight: 1.1 }}>
                    {tip.value}<span style={{ fontSize: 13, marginLeft: 2 }}>{tip.unit}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--text-2)", fontWeight: 600 }}>{tip.label}</div>
                  {/* indikátor, ktorá zo 4 hodnôt je aktívna */}
                  <div style={{ display: "flex", gap: 4, marginTop: 7 }}>
                    {tips.map((_, i) => (
                      <span key={i} style={{
                        width: 5, height: 5, borderRadius: "50%",
                        background: i === tipIdx ? tip.color : "var(--border-2)",
                      }} />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 600 }}>
                    {cur.dist.toFixed(1)} km
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: colorFor(cur), lineHeight: 1.1 }}>
                    {cur.power}<span style={{ fontSize: 13, marginLeft: 2 }}>W</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: cur.zone ? cur.zone.color : "var(--text-3)", fontWeight: 600 }}>
                    {cur.zone ? cur.zone.label : "tep neznámy"}
                  </div>
                </>
              )}
            </div>
          )}

          {/* na celej obrazovke je hlavný slajder schovaný → pridáme ho na spodnú hranu mapy */}
          {mapFull && (
            <div style={{
              position: "absolute", left: 16, right: 16, bottom: 16, zIndex: 1200,
              background: "var(--glass)", border: "1px solid var(--border)",
              borderRadius: 14, padding: "11px 16px", backdropFilter: "blur(8px)",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{ fontSize: 12, color: "#7fb0ff", fontWeight: 700, minWidth: 58 }}>
                {cur.dist.toFixed(1)} km
              </span>
              <input
                type="range" min={0} max={ride.length - 1} value={sliderVal}
                onChange={(e) => glideTo(parseInt(e.target.value))}
                onPointerUp={stopGlide}
                onPointerCancel={stopGlide}
                onMouseUp={stopGlide}
                onTouchEnd={stopGlide}
                style={{ flex: 1, accentColor: "#ff8a3d", cursor: "pointer", touchAction: "none" }}
              />
              <span style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 700, minWidth: 50, textAlign: "right" }}>
                {totalDist.toFixed(1)} km
              </span>
            </div>
          )}
        </div>

        {/* GRAPH (scrub) – prepínateľný: Výkon / Prevýšenie pozdĺž trasy */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", letterSpacing: 0.5 }}>
              {metric === "ele" ? "PREVÝŠENIE POZDĹŽ TRASY" : "VÝKON POZDĹŽ TRASY"}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              {[["power", "Výkon"], ["ele", "Prevýšenie"]].map(([k, t]) => {
                const on = metric === k;
                return (
                  <button key={k} onClick={() => setMetric(k)} style={{
                    padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 700,
                    border: on ? "1px solid #ffd54a" : "1px solid var(--border)",
                    background: on ? "rgba(255,213,74,0.12)" : "var(--surface-3)",
                    color: on ? "#ffd54a" : "var(--text-2)",
                  }}>{t}</button>
                );
              })}
            </div>
          </div>

          {metric === "ele" && !hasElevation ? (
            /* Prevýšenie bez dát – ponuka dopočtu online */
            <div style={{ minHeight: 90, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 6, padding: "6px 0" }}>
              <Mountain size={20} color="var(--text-3)" style={{ opacity: 0.6 }} />
              <span style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>Trasa neobsahuje výškové dáta</span>
              <span style={{ fontSize: 10.5, color: "var(--text-3)", lineHeight: 1.4, maxWidth: 300 }}>
                Tvoje GPX nemá uložené výšky (&lt;ele&gt;). Môžem ich dopočítať z terénu online.
              </span>
              {eleStatus === "error" && (
                <span style={{ fontSize: 10.5, color: "#ff8a3d", fontWeight: 600 }}>
                  Výšky sa nepodarilo stiahnuť (sieť/limit). Skús znova.
                </span>
              )}
              <button onClick={loadElevation} disabled={eleStatus === "loading"} style={{
                marginTop: 2, background: eleStatus === "loading" ? "var(--border)" : "#ff8a3d",
                border: "none", borderRadius: 10, padding: "8px 14px",
                cursor: eleStatus === "loading" ? "default" : "pointer",
                fontSize: 12, fontWeight: 800, color: eleStatus === "loading" ? "var(--text-2)" : "#0d1320",
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
                  /* Stĺpce výkonu so šírkou podľa vzdialenosti úseku (len výrez) */
                  <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: "block", color: "var(--text)" }}>
                    {Array.from({ length: winEnd - winStart }, (_, k) => {
                      const i = winStart + k;
                      const p = ride[i];
                      const h = Math.max(4, ((p.power - minP) / (maxP - minP || 1)) * 100);
                      const x = xPct(i);
                      return (
                        <rect key={i}
                          x={x} y={100 - h} width={Math.max(0.01, xPct(i + 1) - x)} height={h}
                          fill={i === cIdx ? "currentColor" : colorFor(p)}
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
                  width: 2, background: "var(--text)", pointerEvents: "none",
                }} />
                {/* bod na výškovej krivke */}
                {metric === "ele" && (
                  <div style={{
                    position: "absolute", left: `${xPct(cIdx)}%`, top: `${eY(eles[cIdx])}%`,
                    width: 9, height: 9, borderRadius: "50%", background: "var(--text)",
                    border: "2px solid #ff8a3d", transform: "translate(-50%,-50%)", pointerEvents: "none",
                  }} />
                )}
              </div>
              {/* spodný riadok: pri výkone os v km, pri prevýšení rozsah + stúpanie */}
              {metric === "ele" ? (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "var(--text-3)" }}>
                  <span>{Math.round(eMin)} m</span>
                  <span style={{ color: "#ff8a3d", fontWeight: 700 }}>{Math.round(eles[cIdx])} m · ↑ {eleGain} m</span>
                  <span>{Math.round(eMax)} m</span>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "var(--text-3)" }}>
                  <span>{wDist0.toFixed(1)} km</span>
                  <span>{(wDist0 + wSpan / 2).toFixed(1)} km</span>
                  <span>{(wDist0 + wSpan).toFixed(1)} km</span>
                </div>
              )}
            </>
          )}
          {/* slajder ovláda celú trasu (0..koniec) – nezávisle od priblíženia mapy */}
          <input
            type="range" min={0} max={ride.length - 1} value={sliderVal}
            onChange={(e) => glideTo(parseInt(e.target.value))}
            onPointerUp={stopGlide}
            onPointerCancel={stopGlide}
            onMouseUp={stopGlide}
            onTouchEnd={stopGlide}
            style={{ width: "100%", marginTop: 10, accentColor: "#ff8a3d", cursor: "pointer" }}
          />
        </div>

        {/* DETAIL at current point */}
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          {planned ? (
            <Stat icon={MapPin} label="Do cieľa" value={distToFinish.toFixed(1)} unit="km" color="#7fb0ff" />
          ) : (
            <Stat icon={Zap} label="Výkon" value={cur.power} unit="W" color={colorFor(cur)} />
          )}
          <Stat icon={Heart} label="Tep" value={cur.hr != null ? cur.hr : "—"} unit={cur.hr != null ? "bpm" : ""} color="#ff5470" />
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <Stat icon={Gauge} label="Rýchlosť" value={imported?.planned ? "—" : cur.speed} unit={imported?.planned ? "" : "km/h"} color="#7fb0ff" />
          <Stat icon={TrendingUp} label="Sklon" value={cur.slope} unit="%" color="#ff8a3d" />
        </div>

        {/* source + nav */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 14, padding: "10px 12px",
        }}>
          <button onClick={() => jumpTo(cIdx - 1)} style={navBtn}>
            <ChevronLeft size={18} />
          </button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "#ffd54a" }}>
              <Cpu size={12} /> zdroj: {cur.source}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 2 }}>
              bod {cIdx + 1} / {ride.length}
            </div>
          </div>
          <button onClick={() => jumpTo(cIdx + 1)} style={navBtn}>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, justifyContent: "center" }}>
          {mode === "power" ? (
            <>
              <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>{minP}W</span>
              <div style={{ width: 140, height: 8, borderRadius: 4, background: "linear-gradient(90deg,#3b82f6,#4ade80,#ffd54a,#ff5470)" }} />
              <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>{maxP}W</span>
            </>
          ) : hasZones ? (
            [1, 2, 3, 4, 5].map((z) => {
              const c = hrZone(CFG.restHR + (CFG.maxHR - CFG.restHR) * (0.5 + z * 0.08)).color;
              return <span key={z} style={{ fontSize: 10, fontWeight: 700, color: "#0d1320", background: c, padding: "2px 8px", borderRadius: 6 }}>Z{z}</span>;
            })
          ) : (
            <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>GPX bez tepu – farbím podľa výkonu</span>
          )}
        </div>

        <p style={{ fontSize: 11, color: "var(--text-4)", textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
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
  width: 38, height: 38, borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--surface-2)", color: "var(--text-2)", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};

function Stat({ icon: Icon, label, value, unit, color }) {
  return (
    <div style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <Icon size={13} color={color} />
        <span style={{ fontSize: 11, color: "var(--text-2)", fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.5px" }}>
        {value}<span style={{ fontSize: 12, color: "var(--text-3)", marginLeft: 3 }}>{unit}</span>
      </div>
    </div>
  );
}
