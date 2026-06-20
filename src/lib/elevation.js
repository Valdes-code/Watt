/**
 * Online dopočet výšok terénu (DEM) pre body trasy.
 * Používa sa pre plánované trasy, ktoré v GPX nemajú uložené <ele>
 * (napr. trasy nakreslené na mape) – aby sa dal vykresliť profil prevýšenia
 * a presnejšie odhadnúť výkon podľa sklonu.
 *
 * Zdroj: Open-Meteo Elevation API (zadarmo, bez kľúča, s CORS).
 *   GET .../v1/elevation?latitude=a,b,..&longitude=a,b,..  ->  { elevation: [..] }
 * Limit ~100 súradníc na požiadavku, preto dávkujeme.
 */

const API = "https://api.open-meteo.com/v1/elevation";
const CHUNK = 100; // max. počet bodov na jednu požiadavku
const TIMEOUT_MS = 8000; // tvrdý limit na požiadavku – aby fetch nikdy nevisel

/**
 * Stiahne výšky [m] pre dané body. Poradie výstupu zodpovedá vstupu.
 * Každá dávka má časový limit (AbortController), takže pri blokovanej/pomalej
 * sieti volanie spadne s chybou namiesto nekonečného čakania.
 * @param {Array<{lat:number, lon:number}>} points
 * @param {{signal?: AbortSignal, timeoutMs?: number}} [opts]
 * @returns {Promise<number[]>}
 */
export async function fetchElevations(points, { signal, timeoutMs = TIMEOUT_MS } = {}) {
  if (!Array.isArray(points) || points.length === 0) return [];
  const out = new Array(points.length);

  for (let i = 0; i < points.length; i += CHUNK) {
    const chunk = points.slice(i, i + CHUNK);
    const lat = chunk.map((p) => p.lat.toFixed(6)).join(",");
    const lon = chunk.map((p) => p.lon.toFixed(6)).join(",");

    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    if (signal) signal.addEventListener("abort", onAbort);
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let data;
    try {
      const res = await fetch(`${API}?latitude=${lat}&longitude=${lon}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`Elevation API zlyhalo (HTTP ${res.status})`);
      data = await res.json();
    } catch (e) {
      if (ctrl.signal.aborted && !(signal && signal.aborted)) {
        throw new Error("Sťahovanie výšok trvalo príliš dlho (timeout)");
      }
      throw e;
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
    }

    const els = data?.elevation;
    if (!Array.isArray(els) || els.length !== chunk.length) {
      throw new Error("Neočakávaná odpoveď z elevation API");
    }
    for (let j = 0; j < els.length; j++) out[i + j] = els[j];
  }
  return out;
}

/**
 * Vráti kópiu bodov s doplnenými výškami (mutáciu vstupu nerobí).
 * @param {Array} points  body z parseGpx().points
 * @param {{signal?: AbortSignal}} [opts]
 * @returns {Promise<Array>}
 */
export async function enrichWithElevation(points, opts) {
  const eles = await fetchElevations(points, opts);
  return points.map((p, i) => ({ ...p, ele: eles[i] }));
}
