import { useState, useEffect, useCallback } from "react";
import { loadMode, saveMode, applyTheme, autoEffective, sunTimes } from "./theme.js";

// Riadi tému appky: režim (light/dark/auto), efektívnu tému, polohu a slnečné časy.
export function useTheme() {
  const [mode, setMode] = useState(loadMode);
  const [coords, setCoords] = useState(null);
  const [geo, setGeo] = useState("idle"); // idle | locating | ok | denied | unavailable
  const [effective, setEffective] = useState("dark");
  const [sun, setSun] = useState(null);

  // Pri 'auto' zisti polohu (pre výpočet západu slnka).
  useEffect(() => {
    if (mode !== "auto") return;
    if (!("geolocation" in navigator)) { setGeo("unavailable"); return; }
    setGeo("locating");
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lon: p.coords.longitude }); setGeo("ok"); },
      () => setGeo("denied"),
      { timeout: 8000, maximumAge: 3600000 }
    );
  }, [mode]);

  // Vypočítaj efektívnu tému a periodicky prehodnocuj (zachytí západ/východ slnka).
  useEffect(() => {
    let timer;
    const tick = () => {
      const now = new Date();
      let eff = mode;
      if (mode === "auto") {
        eff = autoEffective(now, coords);
        setSun(coords ? sunTimes(now, coords.lat, coords.lon) : null);
      } else {
        setSun(null);
      }
      setEffective(eff);
      applyTheme(eff);
      timer = setTimeout(tick, 5 * 60 * 1000);
    };
    tick();
    return () => clearTimeout(timer);
  }, [mode, coords]);

  const change = useCallback((m) => { setMode(m); saveMode(m); }, []);
  return { mode, effective, sun, coords, geo, change };
}
