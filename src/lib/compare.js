// Porovnanie dvoch jázd: či sú obsahovo identické, alebo sa zhodujú len názvom.
import { parseGpx, haversine } from "./gpx.js";

const r5 = (n) => Math.round(n * 1e5) / 1e5; // ~1 m presnosť

// Kompaktný „odtlačok" geometrie trasy – robustný voči medzerám/metadátam v GPX,
// ale citlivý na skutočný priebeh (počet bodov, dĺžka, krajné body, kontrolný súčet).
export function rideSignature(gpx) {
  const { points } = parseGpx(gpx);
  let dist = 0, checksum = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    checksum += r5(p.lat) + r5(p.lon);
    if (i > 0) dist += haversine(points[i - 1].lat, points[i - 1].lon, p.lat, p.lon);
  }
  const a = points[0], b = points[points.length - 1];
  return [
    points.length,
    Math.round(dist),
    `${r5(a.lat)},${r5(a.lon)}`,
    `${r5(b.lat)},${r5(b.lon)}`,
    Math.round(checksum * 1e3),
  ].join("|");
}

// Základ názvu bez prípony a koncového „(n)" – „Karvina(2).gpx" → „karvina".
export function baseName(name) {
  const dot = (name || "").lastIndexOf(".");
  let base = dot > 0 ? name.slice(0, dot) : (name || "");
  const m = /^(.*)\((\d+)\)$/.exec(base);
  return (m ? m[1] : base).trim().toLowerCase();
}

const safeSig = (gpx) => { try { return rideSignature(gpx); } catch { return null; } };

// Klasifikuje vzťah dvoch jázd. Vstup: { name, gpx } alebo { name, signature }.
// relation: "identical" (rovnaká trasa) | "same-name" (len rovnaký názov) | "different".
export function compareRides(a, b) {
  const sigA = a.signature ?? safeSig(a.gpx);
  const sigB = b.signature ?? safeSig(b.gpx);
  const identical = sigA != null && sigA === sigB;
  const sameName = baseName(a.name) === baseName(b.name);
  return { identical, sameName, relation: identical ? "identical" : sameName ? "same-name" : "different" };
}
