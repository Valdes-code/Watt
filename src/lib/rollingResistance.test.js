import { describe, it, expect } from "vitest";
import {
  TIRE_TYPES,
  pressureCorrection,
  widthCorrection,
  tubeTypeCorrection,
  computeCrr,
  deriveCrr,
  updateLearnedCrr,
} from "./rollingResistance.js";

describe("pressureCorrection", () => {
  it("nižší tlak na asfalte zvyšuje Crr", () => {
    const base = 0.005;
    expect(pressureCorrection(base, 4, 6, "asphalt")).toBeGreaterThan(base);
  });

  it("referenčný tlak nechá Crr (takmer) nezmenené", () => {
    const base = 0.005;
    expect(pressureCorrection(base, 6, 6, "asphalt")).toBeCloseTo(base, 5);
  });

  it("na štrku je citlivosť na tlak nulová, ale vysoký tlak penalizuje (impedancia)", () => {
    const base = 0.009;
    // bar > 4 na štrku pridá impedanciu
    expect(pressureCorrection(base, 7, 6, "gravel")).toBeGreaterThan(base);
  });

  it("nikdy neklesne pod podlahu 0.0015", () => {
    expect(pressureCorrection(0.002, 20, 6, "asphalt")).toBeGreaterThanOrEqual(0.0015);
  });

  it("neznámy povrch spadne na citlivosť asfaltu", () => {
    const base = 0.005;
    expect(pressureCorrection(base, 4, 6, "neznámy")).toBeCloseTo(
      pressureCorrection(base, 4, 6, "asphalt"),
      10
    );
  });
});

describe("widthCorrection", () => {
  it("širší plášť pri rovnakej referencii mierne znižuje Crr", () => {
    const base = 0.005;
    expect(widthCorrection(base, 32, 28)).toBeLessThan(base);
  });

  it("užší plášť Crr zvyšuje", () => {
    const base = 0.005;
    expect(widthCorrection(base, 23, 28)).toBeGreaterThan(base);
  });

  it("referenčná šírka nechá Crr nezmenené", () => {
    const base = 0.005;
    expect(widthCorrection(base, 28, 28)).toBeCloseTo(base, 10);
  });

  it("veľmi široký plášť narazí na dolný clamp faktora (0.85)", () => {
    const base = 0.005;
    expect(widthCorrection(base, 200, 28)).toBeCloseTo(base * 0.85, 10);
  });
});

describe("tubeTypeCorrection", () => {
  it("tubeless nechá Crr nezmenené", () => {
    expect(tubeTypeCorrection(0.005, true)).toBe(0.005);
  });

  it("duša pridá ~8 % odporu", () => {
    expect(tubeTypeCorrection(0.005, false)).toBeCloseTo(0.005 * 1.08, 10);
  });
});

describe("computeCrr", () => {
  it("vráti Crr z modelu so zdrojom 'model'", () => {
    const { crr, source } = computeCrr({ type: "road_train", widthMm: 28, pressureBar: 6 });
    expect(source).toBe("model");
    expect(crr).toBeGreaterThan(0.003);
    expect(crr).toBeLessThan(0.018);
  });

  it("naučená hodnota má prednosť pred modelom", () => {
    const { crr, source } = computeCrr({ type: "road_race", learnedCrr: 0.0042 });
    expect(source).toBe("naučené");
    expect(crr).toBe(0.0042);
  });

  it("ignoruje neplatné naučené Crr (<=0) a použije model", () => {
    expect(computeCrr({ type: "road_train", learnedCrr: 0 }).source).toBe("model");
    expect(computeCrr({ type: "road_train", learnedCrr: -1 }).source).toBe("model");
  });

  it("neznámy typ plášťa spadne na road_train", () => {
    const unknown = computeCrr({ type: "neexistuje" });
    const fallback = computeCrr({ type: "road_train" });
    expect(unknown.crr).toBe(fallback.crr);
  });

  it("MTB má vyšší Crr než cestný závodný", () => {
    expect(computeCrr({ type: "mtb" }).crr).toBeGreaterThan(computeCrr({ type: "road_race" }).crr);
  });

  it("chýbajúca šírka použije refWidth typu (žiadna korekcia šírky)", () => {
    const t = TIRE_TYPES.gravel;
    const withRef = computeCrr({ type: "gravel", widthMm: t.refWidth });
    const noWidth = computeCrr({ type: "gravel" });
    expect(noWidth.crr).toBe(withRef.crr);
  });
});

describe("deriveCrr", () => {
  const base = {
    measuredPower: 200,
    speed: 8,
    slope: 0,
    totalMass: 83,
    cda: 0.32,
    rho: 1.2,
  };

  it("na rovine pri rozumnej rýchlosti vráti reálne Crr", () => {
    const crr = deriveCrr(base);
    expect(crr).not.toBeNull();
    expect(crr).toBeGreaterThanOrEqual(0.0015);
    expect(crr).toBeLessThanOrEqual(0.03);
  });

  it("odmietne strmý sklon (nevhodné podmienky)", () => {
    expect(deriveCrr({ ...base, slope: 0.05 })).toBeNull();
  });

  it("odmietne príliš nízku rýchlosť", () => {
    expect(deriveCrr({ ...base, speed: 1 })).toBeNull();
  });

  it("odmietne, keď valivá zložka vyjde nekladná (príliš malý výkon)", () => {
    expect(deriveCrr({ ...base, measuredPower: 1 })).toBeNull();
  });

  it("odmietne hodnoty mimo reálneho rozsahu (príliš veľký výkon -> Crr > 0.03)", () => {
    expect(deriveCrr({ ...base, measuredPower: 5000 })).toBeNull();
  });
});

describe("updateLearnedCrr", () => {
  const empty = { crr: 0, samples: 0, confidence: 0 };

  it("prvá vzorka inicializuje learner", () => {
    const next = updateLearnedCrr(empty, 0.005);
    expect(next).toEqual({ crr: 0.005, samples: 1, confidence: 0.05 });
  });

  it("null vzorka nechá learner bez zmeny", () => {
    const state = { crr: 0.005, samples: 3, confidence: 0.1 };
    expect(updateLearnedCrr(state, null)).toBe(state);
  });

  it("ďalšie vzorky kĺzavo priemerujú (rovnaká váha pri dvoch vzorkách)", () => {
    let s = updateLearnedCrr(empty, 0.006);
    s = updateLearnedCrr(s, 0.004);
    expect(s.samples).toBe(2);
    expect(s.crr).toBeCloseTo(0.005, 10); // priemer 0.006 a 0.004
    expect(s.confidence).toBeCloseTo(2 / 200, 10);
  });

  it("dôvera je obmedzená na 1 (samples/200)", () => {
    let s = { crr: 0.005, samples: 999, confidence: 0.99 };
    s = updateLearnedCrr(s, 0.005);
    expect(s.confidence).toBe(1);
  });

  it("konverguje k stabilnej hodnote pri konzistentných vzorkách", () => {
    let s = empty;
    for (let i = 0; i < 50; i++) s = updateLearnedCrr(s, 0.0045);
    expect(s.crr).toBeCloseTo(0.0045, 4);
    expect(s.samples).toBe(50);
  });
});
