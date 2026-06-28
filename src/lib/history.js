// História importovaných/jazdených trás – zdieľaná medzi „Import GPX" a
// záložkou „História jázd". Uchová raw GPX, aby sa dala trasa znova načítať.
// Klzné okno max HMAX záznamov; duplicitný obsah GPX sa neukladá dvakrát.
export const HKEY = "watt_gpx_history";
export const HMAX = 8;

export const loadHistory = () => {
  try { return JSON.parse(localStorage.getItem(HKEY)) || []; } catch { return []; }
};

export const saveHistory = (arr) => {
  try { localStorage.setItem(HKEY, JSON.stringify(arr)); } catch { /* plný/zakázaný storage */ }
};

// Pridá/posunie trasu na vrchol histórie (dedup podľa obsahu GPX). Vracia nové pole.
export const pushHistory = (name, text, ride) => {
  const entry = { id: String(Date.now()), name, dist: ride.distanceKm, planned: !!ride.planned, ts: Date.now(), gpx: text };
  const next = [entry, ...loadHistory().filter((e) => e.gpx !== text)].slice(0, HMAX);
  saveHistory(next);
  return next;
};

export const removeFromHistory = (id) => {
  const next = loadHistory().filter((e) => e.id !== id);
  saveHistory(next);
  return next;
};
