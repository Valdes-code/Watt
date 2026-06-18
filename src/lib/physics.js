/**
 * CycloWatt – Fyzikálny engine
 * ============================
 * Zdieľaný výpočtový model pre odhad výkonu na bicykli.
 * Doteraz bol duplikovaný inline v komponentoch (RideAnalysis, CycloWattPreview);
 * tu je na jednom mieste, aby ho mohol používať aj GPX import.
 *
 * Výkon prekonáva tri zložky odporu:
 *   P = (P_gravitácia + P_vzduch + P_valenie) / účinnosť_pohonu
 */

export const G = 9.80665; // gravitačné zrýchlenie [m/s²]
export const DRIVE_EFF = 0.976; // účinnosť pohonu (reťaz, ložiská)

/**
 * Hustota vzduchu z nadmorskej výšky a teploty (barometrická formula).
 * @param {number} altitude  nadmorská výška [m]
 * @param {number} tempC     teplota [°C]
 * @returns {number} hustota [kg/m³]
 */
export function airDensity(altitude = 200, tempC = 15) {
  const p = 101325 * Math.exp((-G * 0.0289644 * altitude) / (8.31447 * (tempC + 273.15)));
  return p / (287.058 * (tempC + 273.15));
}

/**
 * Odhad CdA (súčin odporového koeficientu a čelnej plochy) z antropometrie.
 * @param {number} heightM  výška jazdca [m]
 * @param {number} massKg   hmotnosť jazdca [kg]
 * @param {string} pos      poloha tela: 'hoods' | 'drops' | 'aero' | 'upright'
 * @returns {number} CdA [m²]
 */
export function estimateCdA(heightM, massKg, pos = "hoods") {
  const bsa = 0.007184 * Math.pow(heightM * 100, 0.725) * Math.pow(massKg, 0.425);
  const pf = { hoods: 0.32, drops: 0.28, aero: 0.23, upright: 0.4 }[pos] ?? 0.32;
  const Cd = { hoods: 1.0, drops: 0.88, aero: 0.7, upright: 1.15 }[pos] ?? 1.0;
  return Cd * (bsa * pf + 0.07);
}

/**
 * Celkový potrebný výkon na pedáloch pre dané podmienky.
 * @param {Object} p
 * @param {number} p.speed      rýchlosť po zemi [m/s]
 * @param {number} p.slope      sklon (bezrozmerný, napr. 0.06 = 6 %)
 * @param {number} p.totalMass  celková hmotnosť (jazdec + bicykel) [kg]
 * @param {number} p.cda        CdA [m²]
 * @param {number} p.crr        valivý odpor (bezrozmerný)
 * @param {number} p.rho        hustota vzduchu [kg/m³]
 * @param {number} [p.wind]     zložka vetra v smere jazdy [m/s] (+ protivietor)
 * @returns {number} výkon [W] (>= 0)
 */
export function calcPower({ speed, slope, totalMass, cda, crr, rho, wind = 0 }) {
  const air = speed + wind;
  const pGrav = totalMass * G * slope * speed;
  const pAir = 0.5 * rho * cda * air * air * speed;
  const pRoll = totalMass * G * crr * Math.cos(Math.atan(slope)) * speed;
  return Math.max(0, Math.round((pGrav + pAir + pRoll) / DRIVE_EFF));
}

/**
 * Dôveryhodnosť fyzikálneho odhadu. Pri prudkom klesaní (jazdec netlačí)
 * a takmer nulovej rýchlosti je model nespoľahlivý.
 * @returns {number} 0.05 .. 1
 */
export function physicsTrust({ slope, speed }) {
  let t = 1;
  if (slope < -0.005) t -= Math.min(0.7, Math.abs(slope) * 30);
  if (speed < 2) t -= 0.4;
  return Math.max(0.05, Math.min(1, t));
}

/**
 * Fúzia fyzikálneho odhadu s odhadom z tepovej frekvencie.
 * Čím nižšia dôvera vo fyziku, tým väčšiu váhu dostane tep.
 */
export function fuse(physPower, hrPower, trust, hrConfidence = 0.85) {
  const hrW = (1 - trust) * hrConfidence;
  const power = Math.max(0, Math.round(physPower * (1 - hrW) + hrPower * hrW));
  let source = "fúzia";
  if (hrW < 0.15) source = "fyzika";
  else if (hrW > 0.7) source = "tep";
  return { power, source };
}

/**
 * Tepová zóna z aktuálnej TF a pokojovej/maximálnej TF (Karvonen).
 */
export function hrZone(hr, rest = 60, max = 190) {
  const pct = (hr - rest) / (max - rest);
  if (pct < 0.6) return { zone: 1, label: "Regenerácia", color: "#4ade80" };
  if (pct < 0.7) return { zone: 2, label: "Vytrvalosť", color: "#7fb0ff" };
  if (pct < 0.8) return { zone: 3, label: "Tempo", color: "#ffd54a" };
  if (pct < 0.9) return { zone: 4, label: "Prah", color: "#ff8a3d" };
  return { zone: 5, label: "VO2 max", color: "#ff5470" };
}
