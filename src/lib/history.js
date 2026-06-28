// História importovaných/jazdených trás – zdieľaná medzi „Import GPX" a
// záložkou „História jázd". Uchová raw GPX, aby sa dala trasa znova načítať.
// Klzné okno – veľkosť si nastaví používateľ v Profile (loadHistoryMax);
// duplicitný obsah GPX sa neukladá dvakrát.
export const HKEY = "watt_gpx_history";
export const HMAX_KEY = "watt_gpx_history_max";
export const HMAX_DEFAULT = 8;
export const HMAX_MIN = 3;
export const HMAX_MAX = 50;

export const loadHistory = () => {
  try { return JSON.parse(localStorage.getItem(HKEY)) || []; } catch { return []; }
};

export const saveHistory = (arr) => {
  try { localStorage.setItem(HKEY, JSON.stringify(arr)); } catch { /* plný/zakázaný storage */ }
};

// Maximálny počet záznamov v histórii (nastaviteľný v Profile).
export const loadHistoryMax = () => {
  try {
    const v = parseInt(localStorage.getItem(HMAX_KEY), 10);
    return Number.isFinite(v) ? Math.min(HMAX_MAX, Math.max(HMAX_MIN, v)) : HMAX_DEFAULT;
  } catch { return HMAX_DEFAULT; }
};

// Uloží nový limit a hneď oreže existujúcu históriu. Vracia platný limit.
export const saveHistoryMax = (n) => {
  const v = Math.min(HMAX_MAX, Math.max(HMAX_MIN, Math.trunc(n) || HMAX_DEFAULT));
  try { localStorage.setItem(HMAX_KEY, String(v)); } catch { /* plný/zakázaný storage */ }
  const cur = loadHistory();
  if (cur.length > v) saveHistory(cur.slice(0, v));
  return v;
};

// Normalizuje jeden záznam zo zálohy (tolerantne, s rozumnými predvolbami).
const normalizeEntry = (e, i) => ({
  id: String(e.id || `${e.ts || 0}-${i}`),
  name: String(e.name || "Trasa.gpx"),
  dist: Number(e.dist) || 0,
  planned: !!e.planned,
  ts: Number(e.ts) || 0,
  gpx: e.gpx,
});

// Zlúči importované záznamy s aktuálnou históriou (dedup podľa GPX, najnovšie
// navrch), oreže na nastavený limit. Vracia nové pole. Hodí chybu pri zlom vstupe.
export const importHistoryEntries = (entries) => {
  if (!Array.isArray(entries)) throw new Error("súbor neobsahuje zoznam jázd");
  const clean = entries
    .filter((e) => e && typeof e.gpx === "string" && e.gpx.length)
    .map(normalizeEntry);
  if (!clean.length) throw new Error("súbor neobsahuje žiadne platné trasy");

  const seenGpx = new Set();
  const usedIds = new Set();
  const merged = [];
  for (const e of [...clean, ...loadHistory()]) {
    if (seenGpx.has(e.gpx)) continue;
    seenGpx.add(e.gpx);
    let id = e.id;
    while (usedIds.has(id)) id = id + "_";
    usedIds.add(id);
    merged.push({ ...e, id });
  }
  merged.sort((a, b) => b.ts - a.ts);
  const next = merged.slice(0, loadHistoryMax());
  saveHistory(next);
  return next;
};

// Pridá/posunie trasu na vrchol histórie (dedup podľa obsahu GPX). Vracia nové pole.
export const pushHistory = (name, text, ride) => {
  const entry = { id: String(Date.now()), name, dist: ride.distanceKm, planned: !!ride.planned, ts: Date.now(), gpx: text };
  const next = [entry, ...loadHistory().filter((e) => e.gpx !== text)].slice(0, loadHistoryMax());
  saveHistory(next);
  return next;
};

export const removeFromHistory = (id) => {
  const next = loadHistory().filter((e) => e.id !== id);
  saveHistory(next);
  return next;
};
