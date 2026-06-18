/**
 * Ukážkové GPX trasy pre demo importu.
 * Generované synteticky, ale ako platný GPX – prechádzajú rovnakým parserom
 * (parseGpx) ako skutočné súbory, takže ich štatistiky sú reálne dopočítané.
 */

const START_TIME = Date.parse("2026-06-14T07:30:00Z");

/**
 * Postaví platný GPX dokument z poľa bodov.
 * @param {Array<{lat:number, lon:number, ele:number, t:number, power?:number}>} pts
 */
function buildGpx(pts, name) {
  const trkpts = pts
    .map((p) => {
      const time = new Date(START_TIME + p.t * 1000).toISOString();
      const ext =
        p.power != null
          ? `<extensions><power>${Math.round(p.power)}</power></extensions>`
          : "";
      return `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><ele>${p.ele.toFixed(1)}</ele><time>${time}</time>${ext}</trkpt>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="CycloWatt sample">
  <trk><name>${name}</name><trkseg>
${trkpts}
  </trkseg></trk>
</gpx>`;
}

/**
 * Vygeneruje trasu: zvlnený profil výšky, premenlivá rýchlosť, voliteľne výkon.
 * @param {Object} o
 * @param {number} o.n        počet bodov
 * @param {number} o.totalKm  cieľová dĺžka [km]
 * @param {boolean} o.withPower zapísať výkon z merača
 */
function makeRoute({ n, totalKm, withPower }) {
  const pts = [];
  const lat0 = 48.15, lon0 = 17.11; // okolie Bratislavy
  // ~111 km na stupeň zem. šírky; krok tak, aby súčet vyšiel na totalKm.
  const stepDeg = totalKm / n / 111;
  let t = 0;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    // Zvlnený smer trasy (jemné zatáčanie)
    const lat = lat0 + stepDeg * i * (0.7 + 0.3 * Math.sin(f * Math.PI * 2));
    const lon = lon0 + stepDeg * i * 0.4 * Math.cos(f * Math.PI * 3);
    // Profil výšky: stúpanie do polovice, potom zjazd + zvlnenie
    const ele = 200 + 320 * Math.sin(f * Math.PI) + 25 * Math.sin(f * Math.PI * 9);
    // Rýchlosť podľa sklonu: do kopca pomaly, dole rýchlo
    const climbing = f < 0.5;
    const speedKmh = climbing ? 17 + 4 * Math.sin(f * 20) : 38 + 6 * Math.sin(f * 18);
    if (i > 0) {
      const prev = pts[i - 1];
      const dKm =
        Math.hypot((lat - prev.lat) * 111, (lon - prev.lon) * 111 * Math.cos((lat * Math.PI) / 180));
      t += (dKm / speedKmh) * 3600;
    }
    const power = withPower ? (climbing ? 250 + 60 * Math.sin(f * 20) : 160 + 40 * Math.sin(f * 18)) : null;
    pts.push({ lat, lon, ele, t, power });
  }
  return pts;
}

export const SAMPLE_GPX = {
  morning: buildGpx(makeRoute({ n: 120, totalKm: 42, withPower: false }), "Morning Ride"),
  garmin: buildGpx(makeRoute({ n: 160, totalKm: 65, withPower: true }), "Activity 2026"),
};
