// Tréningový stav z histórie jázd (zjednodušený model TrainingPeaks/Garmin).
// Záťaž jazdy = TSS → exponenciálne priemery: CTL (kondícia, 42 dní),
// ATL (únava, 7 dní), TSB = CTL − ATL (forma). Z nich sa odvodí stav.
import { importGpx, DEFAULT_PROFILE } from "./gpx.js";

// Odhad FTP (funkčný prahový výkon). Ak ho používateľ nemá, ~2.5 W/kg.
export const estimateFtp = (user) => {
  if (user?.ftp && user.ftp > 0) return user.ftp;
  return Math.round((user?.riderKg || 75) * 2.5);
};

const activeBikeKg = (user) => {
  const b = user?.bikes?.find((x) => x.id === user.activeBikeId) || user?.bikes?.[0];
  return b?.weightKg || DEFAULT_PROFILE.bikeMass;
};

// Training Stress Score jednej jazdy. IF = avgPower/FTP; TSS = sec·IF²/36.
export const rideTss = (avgPower, sec, ftp) => {
  if (!avgPower || avgPower <= 0 || !sec || sec <= 0 || !ftp || ftp <= 0) return 0;
  const intf = avgPower / ftp;
  return (sec * intf * intf) / 36;
};

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// Denné súčty TSS od prvej jazdy po „dnes" (chýbajúce dni = 0).
export function buildDailyTss(rides, today) {
  if (!rides.length) return { days: [], tss: [] };
  const byDay = new Map();
  for (const r of rides) byDay.set(dayKey(startOfDay(r.date)), (byDay.get(dayKey(startOfDay(r.date))) || 0) + r.tss);
  const start = startOfDay(new Date(Math.min(...rides.map((r) => +startOfDay(r.date)))));
  const end = startOfDay(today);
  const days = [], tss = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
    tss.push(byDay.get(dayKey(d)) || 0);
  }
  return { days, tss };
}

// Exponenciálne vážený priemer (impulzová odozva s časovou konštantou tau dní).
export function ewma(dailyTss, tau) {
  const k = 1 - Math.exp(-1 / tau);
  let v = 0;
  return dailyTss.map((t) => (v += k * (t - v)));
}

// Klasifikácia tréningového stavu z metrík.
export function classify({ ctl, tsb, ramp }) {
  if (ctl < 1) return { key: "nodata", label: "Málo dát", color: "var(--text-3)", desc: "Naimportuj viac odjazdených jázd (s časom), aby sme vedeli určiť tréningový stav." };
  if (tsb < -30) return { key: "strained", label: "Preťaženie", color: "#ff5470", desc: "Vysoká únava. Zaraď odpočinok, inak riskuješ prepálenie formy." };
  if (ramp > 3 && tsb <= 5) return { key: "productive", label: "Produktívny", color: "#4ade80", desc: "Kondícia stúpa a únavu zvládaš – takto sa rastie. Pokračuj." };
  if (tsb > 20 && ramp < -0.5) return { key: "recovery", label: "Zotavenie", color: "#7fb0ff", desc: "Odpočívaš, kondícia mierne klesá. Ideálne ladenie pred pretekmi." };
  if (ramp < -4) return { key: "detraining", label: "Strata kondície", color: "#ff8a3d", desc: "Tréningová záťaž klesá – kondícia sa vytráca. Pridaj jazdy." };
  if (tsb > 5) return { key: "fresh", label: "Čerstvá forma", color: "#ffd54a", desc: "Si oddýchnutý a pripravený na výkon." };
  return { key: "maintaining", label: "Udržiavanie", color: "#7fb0ff", desc: "Držíš kondíciu na stabilnej úrovni." };
}

// Dátum jazdy z prvej časovej značky v GPX (inak null → použije sa dátum importu).
export function rideDateFromGpx(gpx) {
  const m = typeof gpx === "string" && gpx.match(/<time>([^<]+)<\/time>/i);
  if (!m) return null;
  const t = Date.parse(m[1]);
  return Number.isFinite(t) ? new Date(t) : null;
}

// Hlavná analýza: z položiek histórie spočíta CTL/ATL/TSB a stav.
export function analyzeTraining(entries, user, today = new Date()) {
  const ftp = estimateFtp(user);
  const profile = { ...DEFAULT_PROFILE, riderMass: user?.riderKg || DEFAULT_PROFILE.riderMass, bikeMass: activeBikeKg(user) };
  const rides = [];
  for (const e of entries || []) {
    try {
      const ride = importGpx(e.gpx, profile);
      const date = rideDateFromGpx(e.gpx) || new Date(e.ts);
      const sec = ride.movingSec || ride.durationSec;
      rides.push({ id: e.id, name: e.name, date, tss: rideTss(ride.avgPower, sec, ftp), distanceKm: ride.distanceKm, avgPower: ride.avgPower, planned: ride.planned });
    } catch { /* nevalidná jazda – preskoč */ }
  }
  rides.sort((a, b) => a.date - b.date);

  const { days, tss } = buildDailyTss(rides, today);
  const ctlArr = ewma(tss, 42), atlArr = ewma(tss, 7);
  const ctl = ctlArr.length ? ctlArr[ctlArr.length - 1] : 0;
  const atl = atlArr.length ? atlArr[atlArr.length - 1] : 0;
  const tsb = ctl - atl;
  const ago = ctlArr.length > 7 ? ctlArr[ctlArr.length - 8] : (ctlArr[0] || 0);
  const ramp = ctl - ago; // zmena kondície za ~7 dní
  return { ftp, ctl, atl, tsb, ramp, status: classify({ ctl, tsb, ramp }), rides, days, dailyTss: tss };
}
