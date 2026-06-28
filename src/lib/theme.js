// Téma aplikácie: režim (light/dark/auto) + výpočet východu/západu slnka.
// Pri 'auto' sa po západe slnka prepne na tmavú, cez deň na svetlú.

export const THEME_KEY = "watt_theme_mode";

export function loadMode() {
  try { return localStorage.getItem(THEME_KEY) || "auto"; } catch { return "auto"; }
}
export function saveMode(mode) {
  try { localStorage.setItem(THEME_KEY, mode); } catch { /* zakázaný storage */ }
}

// Aplikuje efektívnu tému na <html> (CSS premenné cez [data-theme], + colorScheme).
export function applyTheme(effective) {
  const el = document.documentElement;
  el.dataset.theme = effective;
  el.style.colorScheme = effective;
}

const rad = Math.PI / 180;
const norm360 = (x) => ((x % 360) + 360) % 360;
const norm24 = (x) => ((x % 24) + 24) % 24;

// Východ/západ slnka pre daný deň a polohu (algoritmus „Almanac for Computers", zenith 90.833°).
// Vracia { sunrise: Date, sunset: Date } v absolútnom čase (UTC), alebo null pri polárnom dni/noci.
export function sunTimes(date, lat, lon) {
  const zenith = 90.833;
  // deň v roku
  const y = date.getUTCFullYear(), m = date.getUTCMonth() + 1, d = date.getUTCDate();
  const N1 = Math.floor(275 * m / 9);
  const N2 = Math.floor((m + 9) / 12);
  const N3 = 1 + Math.floor((y - 4 * Math.floor(y / 4) + 2) / 3);
  const N = N1 - N2 * N3 + d - 30;

  const lngHour = lon / 15;
  const calc = (rising) => {
    const t = N + ((rising ? 6 : 18) - lngHour) / 24;
    const M = 0.9856 * t - 3.289;                                  // stredná anomália
    let L = M + 1.916 * Math.sin(M * rad) + 0.020 * Math.sin(2 * M * rad) + 282.634;
    L = norm360(L);                                                // pravá dĺžka Slnka
    let RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad;
    RA = norm360(RA);
    RA += (Math.floor(L / 90) * 90) - (Math.floor(RA / 90) * 90);  // do rovnakého kvadrantu ako L
    RA /= 15;
    const sinDec = 0.39782 * Math.sin(L * rad);
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosH = (Math.cos(zenith * rad) - sinDec * Math.sin(lat * rad)) / (cosDec * Math.cos(lat * rad));
    if (cosH > 1 || cosH < -1) return null;                        // slnko nevychádza / nezapadá
    let H = rising ? 360 - Math.acos(cosH) / rad : Math.acos(cosH) / rad;
    H /= 15;
    const T = H + RA - 0.06571 * t - 6.622;                        // miestny čas udalosti
    const UT = norm24(T - lngHour);                                // UTC hodina
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCMinutes(Math.round(UT * 60));
    return dt;
  };
  const sunrise = calc(true), sunset = calc(false);
  if (!sunrise || !sunset) return null;
  return { sunrise, sunset };
}

// Efektívna téma pre 'auto' podľa polohy a aktuálneho času (alebo OS nastavenia, ak poloha chýba).
export function autoEffective(now, coords) {
  if (coords) {
    const t = sunTimes(now, coords.lat, coords.lon);
    if (t) return now >= t.sunrise && now < t.sunset ? "light" : "dark";
  }
  // bez polohy: riaď sa systémovým nastavením
  const prefersLight = typeof window !== "undefined" &&
    window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  return prefersLight ? "light" : "dark";
}
