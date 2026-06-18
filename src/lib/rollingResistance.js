/**
 * CycloWatt – Modul valivého odporu (pokročilý)
 * ==============================================
 * Realistickejší odhad Crr z: typu plášťa, šírky, tlaku, tubeless/duša.
 * + samoučenie: ak máme wattmeter, dopočíta REÁLNE Crr daných pneumatík.
 *
 * Pozn.: Crr je bezrozmerný. Reálne hodnoty (overené napr. testami
 * BicycleRollingResistance) sa na hladkom asfalte pohybujú ~0.003–0.018.
 * Model nižšie je inžiniersky odhad – samoučenie ho nahradí presnou
 * hodnotou, akonáhle má dosť dát z wattmetra.
 */

// ── Základné Crr podľa typu plášťa (referenčné: 28 mm, 6 bar, tubeless) ──
export const TIRE_TYPES = {
  road_race: { label: "Cestný závodný", baseCrr: 0.0035, refWidth: 25 },
  road_train: { label: "Cestný tréningový", baseCrr: 0.0052, refWidth: 28 },
  gravel: { label: "Gravel", baseCrr: 0.009, refWidth: 40 },
  mtb: { label: "MTB", baseCrr: 0.014, refWidth: 55 },
  winter: { label: "Zimný / odolný", baseCrr: 0.0085, refWidth: 32 },
};

/**
 * Korekcia podľa tlaku.
 * Nižší tlak = vyšší odpor na hladkom, ALE na nerovnom povrchu naopak
 * (tzv. "breakpoint pressure" / impedance). Tu modelujeme zjednoducho
 * pre prevažne hladký až zmiešaný povrch.
 *
 * @param {number} crr   základné Crr
 * @param {number} bar   tlak v baroch
 * @param {number} refBar referenčný tlak (default 6)
 * @param {string} surface 'asphalt' | 'mixed' | 'gravel'
 */
export function pressureCorrection(crr, bar, refBar = 6, surface = "asphalt") {
  // Citlivosť tlaku závisí od povrchu
  const sensitivity = { asphalt: 0.04, mixed: 0.02, gravel: 0.0 }[surface] ?? 0.04;
  const delta = (refBar - bar) * sensitivity;
  // Na štrku príliš vysoký tlak odpor zvyšuje (impedancia) – jemná penalizácia
  let impedance = 0;
  if (surface !== "asphalt" && bar > 4) impedance = (bar - 4) * 0.015 * crr * 10;
  return Math.max(0.0015, crr * (1 + delta) + impedance);
}

/**
 * Korekcia podľa šírky plášťa.
 * Širší plášť pri rovnakom tlaku má spravidla mierne nižší Crr.
 */
export function widthCorrection(crr, widthMm, refWidthMm) {
  const factor = 1 - (widthMm - refWidthMm) * 0.004;
  return crr * Math.max(0.85, Math.min(1.15, factor));
}

/**
 * Korekcia tubeless vs duša.
 * Tubeless typicky ~5–10 % nižší odpor (žiadne trenie duše).
 */
export function tubeTypeCorrection(crr, isTubeless) {
  return isTubeless ? crr : crr * 1.08;
}

/**
 * Hlavný výpočet Crr z konfigurácie pneumatík.
 *
 * @param {Object} cfg
 * @param {string} cfg.type      kľúč z TIRE_TYPES
 * @param {number} cfg.widthMm   šírka (mm)
 * @param {number} cfg.pressureBar tlak (bar)
 * @param {boolean} cfg.tubeless tubeless?
 * @param {string} cfg.surface   povrch
 * @param {number} [cfg.learnedCrr] ak existuje naučené Crr, použije sa namiesto modelu
 * @returns {Object} { crr, source }
 */
export function computeCrr({
  type = "road_train",
  widthMm,
  pressureBar = 6,
  tubeless = true,
  surface = "asphalt",
  learnedCrr = null,
}) {
  // Ak máme naučenú hodnotu z wattmetra, dôverujeme jej
  if (learnedCrr && learnedCrr > 0) {
    return { crr: +learnedCrr.toFixed(5), source: "naučené" };
  }
  const t = TIRE_TYPES[type] ?? TIRE_TYPES.road_train;
  let crr = t.baseCrr;
  crr = widthCorrection(crr, widthMm ?? t.refWidth, t.refWidth);
  crr = pressureCorrection(crr, pressureBar, 6, surface);
  crr = tubeTypeCorrection(crr, tubeless);
  return { crr: +crr.toFixed(5), source: "model" };
}

/**
 * SAMOUČENIE – dopočíta reálne Crr z dát wattmetra.
 * Volaj pri jazde po ROVINE, konštantnou rýchlosťou, bez vetra
 * (alebo so známym vetrom). Vtedy je rovnica najstabilnejšia:
 *
 *   Crr = (P_kolesá - P_vzduch - P_grav) / (m * g * cos(θ) * v)
 *
 * @returns {number|null} okamžité Crr alebo null ak podmienky nevhodné
 */
export function deriveCrr({
  measuredPower,
  speed,
  slope,
  totalMass,
  cda,
  rho,
  windSpeed = 0,
  driveEff = 0.976,
}) {
  // Najspoľahlivejšie na rovine pri rozumnej rýchlosti
  if (Math.abs(slope) > 0.01 || speed < 3) return null;
  const wheelPower = measuredPower * driveEff;
  const air = speed + windSpeed;
  const pAir = 0.5 * rho * cda * air * air * speed;
  const pGrav = totalMass * G_LOCAL * slope * speed;
  const pRoll = wheelPower - pAir - pGrav;
  if (pRoll <= 0) return null;
  const crr = pRoll / (totalMass * G_LOCAL * Math.cos(Math.atan(slope)) * speed);
  // Sanity check – mimo reálneho rozsahu zahoď
  if (crr < 0.0015 || crr > 0.03) return null;
  return +crr.toFixed(5);
}

const G_LOCAL = 9.80665;

/**
 * Online priemerovanie naučeného Crr (kĺzavý priemer s dôverou).
 * @param {Object} learner  { crr, samples, confidence }
 * @param {number} newCrr   nová vzorka z deriveCrr()
 */
export function updateLearnedCrr(learner, newCrr) {
  if (newCrr == null) return learner;
  if (learner.samples === 0) {
    return { crr: newCrr, samples: 1, confidence: 0.05 };
  }
  // Kĺzavý priemer – stabilný voči odľahlým hodnotám
  const w = 1 / (learner.samples + 1);
  const crr = learner.crr * (1 - w) + newCrr * w;
  const samples = learner.samples + 1;
  return {
    crr: +crr.toFixed(5),
    samples,
    confidence: Math.min(1, samples / 200),
  };
}
