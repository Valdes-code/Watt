/**
 * CycloWatt – GPX import a dopočet výkonu
 * =======================================
 * Skutočný parser GPX trasy + odhad výkonu pre každý úsek, ak v súbore
 * chýba wattmeter. Nahrádza pôvodnú simuláciu (setTimeout + napevno zadané
 * čísla) v komponente GpxImport.
 *
 * Postup:
 *   1. parseGpx()      – z XML textu vytiahne trackpointy (lat, lon, ele, time)
 *                        a prípadný výkon (rozšírenie <power> v <extensions>).
 *   2. analyzeRide()   – z bodov spočíta vzdialenosť, prevýšenie, trvanie a pre
 *                        každý úsek rýchlosť, sklon a výkon (z merača alebo z fyziky).
 */

import { airDensity, calcPower, estimateCdA } from "./physics.js";
import { computeCrr } from "./rollingResistance.js";

const R_EARTH = 6371008.8; // stredný polomer Zeme [m]

/**
 * Veľkokružnicová (haversine) vzdialenosť medzi dvoma bodmi.
 * @returns {number} vzdialenosť [m]
 */
export function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Vytiahne hodnotu prvého detského tagu z útržku XML.
 * @returns {string|null}
 */
function tagValue(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i"));
  return m ? m[1].trim() : null;
}

/**
 * Naparsuje GPX (alebo TCX-podobné) XML do poľa trackpointov.
 * Funguje bez DOM – vystačí si s regulárnymi výrazmi nad textom, takže beží
 * rovnako v prehliadači aj v Node (testy).
 *
 * @param {string} xml  obsah GPX súboru
 * @returns {{points: Array<{lat:number, lon:number, ele:number|null, time:number|null, power:number|null}>, hasPower: boolean}}
 */
export function parseGpx(xml) {
  if (typeof xml !== "string" || !xml.trim()) {
    throw new Error("Prázdny alebo neplatný GPX vstup");
  }

  const points = [];
  let hasPower = false;
  // Každý <trkpt ...> ... </trkpt>; tolerujeme aj samouzatváracie body bez detí.
  const re = /<trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1] || "";
    const body = m[2] || "";
    const lat = parseFloat((attrs.match(/lat\s*=\s*"([^"]+)"/i) || [])[1]);
    const lon = parseFloat((attrs.match(/lon\s*=\s*"([^"]+)"/i) || [])[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const eleRaw = tagValue(body, "ele");
    const timeRaw = tagValue(body, "time");
    // Výkon býva v <extensions>, najčastejšie ako <power> alebo <ns3:power>.
    const powerRaw =
      tagValue(body, "power") ?? tagValue(body, "ns3:power") ?? tagValue(body, "pwr");

    const ele = eleRaw != null ? parseFloat(eleRaw) : null;
    const time = timeRaw != null ? Date.parse(timeRaw) : null;
    const power = powerRaw != null ? parseFloat(powerRaw) : null;
    if (power != null && Number.isFinite(power)) hasPower = true;

    points.push({
      lat,
      lon,
      ele: Number.isFinite(ele) ? ele : null,
      time: Number.isFinite(time) ? time : null,
      power: Number.isFinite(power) ? power : null,
    });
  }

  if (points.length < 2) {
    throw new Error("GPX neobsahuje dostatok trackpointov (minimum 2)");
  }
  return { points, hasPower };
}

/**
 * Predvolený profil jazdca/bicykla pre dopočet výkonu.
 * Hodnoty zodpovedajú profilu v appke (Cestný tréningový, 28 mm, 6 bar, tubeless).
 */
export const DEFAULT_PROFILE = {
  riderMass: 75,
  bikeMass: 8.5,
  heightM: 1.8,
  position: "hoods",
  tempC: 15,
  tire: { type: "road_train", widthMm: 28, pressureBar: 6, tubeless: true, surface: "asphalt" },
};

const MOVING_MIN_SPEED = 0.5; // [m/s] pod touto rýchlosťou považujeme bod za státie
const MAX_SPEED = 30; // [m/s] ~108 km/h – nad tým je to GPS skok, nie jazda

/**
 * Z trackpointov spočíta súhrn jazdy a metriky pre každý úsek.
 * Ak body neobsahujú výkon z merača, dopočíta ho z fyziky (calcPower).
 *
 * @param {Array} points    výstup z parseGpx().points
 * @param {Object} [profile] profil jazdca/bicykla (pozri DEFAULT_PROFILE)
 * @returns {{
 *   distanceKm:number, elevationGain:number, durationSec:number, movingSec:number,
 *   avgPower:number, maxPower:number, avgSpeedKmh:number, hasPower:boolean,
 *   segments: Array<{dist:number, slope:number, speed:number, power:number, source:string}>
 * }}
 */
export function analyzeRide(points, profile = DEFAULT_PROFILE) {
  if (!Array.isArray(points) || points.length < 2) {
    throw new Error("Na analýzu treba aspoň 2 body");
  }
  const totalMass = profile.riderMass + profile.bikeMass;
  const cda = estimateCdA(profile.heightM, profile.riderMass, profile.position);
  const { crr } = computeCrr(profile.tire);

  let distance = 0; // [m]
  let elevationGain = 0; // [m]
  let movingSec = 0;
  let powerSum = 0; // časovo vážený súčet výkonu cez úseky s pohybom
  let maxPower = 0;
  let measuredCount = 0;
  const segments = [];

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const d = haversine(a.lat, a.lon, b.lat, b.lon);
    distance += d;

    const dEle = a.ele != null && b.ele != null ? b.ele - a.ele : 0;
    if (dEle > 0) elevationGain += dEle;

    const dt = a.time != null && b.time != null ? (b.time - a.time) / 1000 : null;
    const slope = d > 0 ? dEle / d : 0;
    // Hustotu vzduchu berieme podľa priemernej výšky úseku.
    const rho = airDensity(((a.ele ?? 0) + (b.ele ?? 0)) / 2, profile.tempC);

    let speed = dt && dt > 0 ? d / dt : 0;
    if (speed > MAX_SPEED) speed = 0; // odfiltruj GPS skoky

    // Výkon: prednostne z merača (priemer oboch bodov), inak z fyziky.
    let power;
    let source;
    if (a.power != null || b.power != null) {
      const vals = [a.power, b.power].filter((v) => v != null);
      power = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
      source = "merač";
      measuredCount++;
    } else {
      power = speed > 0 ? calcPower({ speed, slope, totalMass, cda, crr, rho }) : 0;
      source = "fyzika";
    }

    segments.push({
      dist: +(distance / 1000).toFixed(3),
      slope: +(slope * 100).toFixed(1),
      speed: +(speed * 3.6).toFixed(1),
      power,
      source,
    });

    if (power > maxPower) maxPower = power;
    if (dt && dt > 0 && speed >= MOVING_MIN_SPEED) {
      movingSec += dt;
      powerSum += power * dt;
    }
  }

  const first = points.find((p) => p.time != null);
  const last = [...points].reverse().find((p) => p.time != null);
  const durationSec = first && last ? Math.max(0, (last.time - first.time) / 1000) : 0;

  const distanceKm = distance / 1000;
  const avgPower = movingSec > 0 ? Math.round(powerSum / movingSec) : 0;
  const avgSpeedKmh = movingSec > 0 ? +((distance / movingSec) * 3.6).toFixed(1) : 0;

  return {
    distanceKm: +distanceKm.toFixed(2),
    elevationGain: Math.round(elevationGain),
    durationSec: Math.round(durationSec),
    movingSec: Math.round(movingSec),
    avgPower,
    maxPower,
    avgSpeedKmh,
    hasPower: measuredCount > 0,
    segments,
  };
}

/**
 * Pohodlný obal: z textu GPX rovno vráti súhrn jazdy.
 * @param {string} xml
 * @param {Object} [profile]
 */
export function importGpx(xml, profile = DEFAULT_PROFILE) {
  const { points } = parseGpx(xml);
  return analyzeRide(points, profile);
}
