import { describe, it, expect } from "vitest";
import {
  G,
  DRIVE_EFF,
  airDensity,
  estimateCdA,
  calcPower,
  physicsTrust,
  fuse,
  hrZone,
} from "./physics.js";

describe("airDensity", () => {
  it("pri hladine mora a 15 °C je ~1.2 kg/m³", () => {
    const rho = airDensity(0, 15);
    expect(rho).toBeGreaterThan(1.21);
    expect(rho).toBeLessThan(1.23);
  });

  it("vo vyššej nadmorskej výške klesá", () => {
    expect(airDensity(2000, 15)).toBeLessThan(airDensity(0, 15));
  });

  it("teplejší vzduch je redší", () => {
    expect(airDensity(200, 35)).toBeLessThan(airDensity(200, 5));
  });

  it("použije predvolené hodnoty (200 m, 15 °C)", () => {
    expect(airDensity()).toBeCloseTo(airDensity(200, 15), 10);
  });
});

describe("estimateCdA", () => {
  it("aero poloha má menšie CdA než upright", () => {
    const aero = estimateCdA(1.8, 75, "aero");
    const upright = estimateCdA(1.8, 75, "upright");
    expect(aero).toBeLessThan(upright);
  });

  it("regresia: zodpovedá Du Bois BSA modelu (hoods)", () => {
    const bsa = 0.007184 * Math.pow(180, 0.725) * Math.pow(75, 0.425);
    const expected = 1.0 * (bsa * 0.32 + 0.07);
    expect(estimateCdA(1.8, 75, "hoods")).toBeCloseTo(expected, 10);
  });

  it("väčší jazdec má väčšie CdA", () => {
    expect(estimateCdA(1.95, 95, "hoods")).toBeGreaterThan(estimateCdA(1.6, 55, "hoods"));
  });

  it("neznáma poloha spadne na default (hoods)", () => {
    expect(estimateCdA(1.8, 75, "neznáma")).toBeCloseTo(estimateCdA(1.8, 75, "hoods"), 10);
  });
});

describe("calcPower", () => {
  const base = { speed: 8, slope: 0, totalMass: 83, cda: 0.32, crr: 0.005, rho: 1.2 };

  it("na rovine vráti kladný výkon v rozumnom rozsahu", () => {
    const p = calcPower(base);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(300);
  });

  it("stúpanie zvyšuje výkon oproti rovine", () => {
    expect(calcPower({ ...base, slope: 0.06 })).toBeGreaterThan(calcPower(base));
  });

  it("nikdy nevráti záporný výkon (prudké klesanie -> 0)", () => {
    expect(calcPower({ ...base, slope: -0.2 })).toBe(0);
  });

  it("protivietor zvyšuje výkon, zadný vietor znižuje", () => {
    expect(calcPower({ ...base, wind: 5 })).toBeGreaterThan(calcPower(base));
    expect(calcPower({ ...base, wind: -5 })).toBeLessThan(calcPower(base));
  });

  it("vracia zaokrúhlené celé číslo", () => {
    expect(Number.isInteger(calcPower(base))).toBe(true);
  });

  it("regresia: známy scenár dáva stabilnú hodnotu", () => {
    // 8 m/s, 6 % stúpanie, 83 kg, CdA 0.32, Crr 0.005, rho 1.2
    const pGrav = 83 * G * 0.06 * 8;
    const pAir = 0.5 * 1.2 * 0.32 * 8 * 8 * 8;
    const pRoll = 83 * G * 0.005 * Math.cos(Math.atan(0.06)) * 8;
    const expected = Math.round((pGrav + pAir + pRoll) / DRIVE_EFF);
    expect(calcPower({ ...base, slope: 0.06 })).toBe(expected);
  });
});

describe("physicsTrust", () => {
  it("na rovine pri normálnej rýchlosti plne dôveruje fyzike", () => {
    expect(physicsTrust({ slope: 0, speed: 8 })).toBe(1);
  });

  it("pri klesaní dôvera klesá", () => {
    expect(physicsTrust({ slope: -0.05, speed: 10 })).toBeLessThan(1);
  });

  it("pri takmer nulovej rýchlosti dôvera klesá", () => {
    expect(physicsTrust({ slope: 0, speed: 1 })).toBeLessThan(1);
  });

  it("nikdy neklesne pod 0.05", () => {
    expect(physicsTrust({ slope: -0.5, speed: 0 })).toBeGreaterThanOrEqual(0.05);
  });

  it("zostáva v rozsahu [0.05, 1]", () => {
    const t = physicsTrust({ slope: -0.03, speed: 1.5 });
    expect(t).toBeGreaterThanOrEqual(0.05);
    expect(t).toBeLessThanOrEqual(1);
  });
});

describe("fuse", () => {
  it("pri vysokej dôvere vo fyziku označí zdroj 'fyzika'", () => {
    const { source, power } = fuse(200, 150, 1);
    expect(source).toBe("fyzika");
    expect(power).toBe(200); // hrW = 0 -> čistá fyzika
  });

  it("pri nízkej dôvere vo fyziku prevažuje tep", () => {
    const { source } = fuse(200, 150, 0);
    expect(source).toBe("tep");
  });

  it("v strednom pásme je zdroj 'fúzia' a výkon medzi oboma", () => {
    const { source, power } = fuse(300, 100, 0.5);
    expect(source).toBe("fúzia");
    expect(power).toBeGreaterThan(100);
    expect(power).toBeLessThan(300);
  });

  it("nevracia záporný výkon", () => {
    expect(fuse(0, 0, 0.5).power).toBeGreaterThanOrEqual(0);
  });
});

describe("hrZone", () => {
  it("nízky tep -> zóna 1 (regenerácia)", () => {
    expect(hrZone(90, 60, 190).zone).toBe(1);
  });

  it("maximálny tep -> zóna 5 (VO2 max)", () => {
    expect(hrZone(190, 60, 190).zone).toBe(5);
  });

  it("pokrýva celé spektrum zón 1–5", () => {
    // rest=60, max=190 -> rozpätie 130 bpm; hranice na 0.6/0.7/0.8/0.9
    const zones = [100, 145, 158, 170, 185].map((hr) => hrZone(hr, 60, 190).zone);
    expect(zones).toEqual([1, 2, 3, 4, 5]);
  });

  it("každá zóna má label aj farbu", () => {
    const z = hrZone(150, 60, 190);
    expect(z.label).toBeTruthy();
    expect(z.color).toMatch(/^#/);
  });
});
