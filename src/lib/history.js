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
