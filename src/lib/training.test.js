import { describe, it, expect } from "vitest";
import { rideTss, ewma, buildDailyTss, classify, estimateFtp, rideDateFromGpx } from "./training.js";

describe("rideTss", () => {
  it("hodina na FTP = 100 TSS", () => {
    expect(rideTss(250, 3600, 250)).toBeCloseTo(100, 5);
  });
  it("hodina na 50 % FTP = 25 TSS", () => {
    expect(rideTss(125, 3600, 250)).toBeCloseTo(25, 5);
  });
  it("nulové/neplatné vstupy → 0", () => {
    expect(rideTss(0, 3600, 250)).toBe(0);
    expect(rideTss(200, 0, 250)).toBe(0);
    expect(rideTss(200, 3600, 0)).toBe(0);
  });
});

describe("estimateFtp", () => {
  it("použije FTP z profilu, ak je", () => {
    expect(estimateFtp({ ftp: 280, riderKg: 75 })).toBe(280);
  });
  it("inak ~2.5 W/kg", () => {
    expect(estimateFtp({ riderKg: 80 })).toBe(200);
  });
});

describe("ewma", () => {
  it("konštantná záťaž konverguje k tej hodnote", () => {
    const arr = ewma(Array(400).fill(50), 42);
    expect(arr[arr.length - 1]).toBeCloseTo(50, 1);
  });
  it("ATL reaguje rýchlejšie než CTL", () => {
    const daily = Array(20).fill(100);
    const ctl = ewma(daily, 42), atl = ewma(daily, 7);
    expect(atl[atl.length - 1]).toBeGreaterThan(ctl[ctl.length - 1]);
  });
});

describe("buildDailyTss", () => {
  it("vyplní chýbajúce dni nulami", () => {
    const d0 = new Date(2026, 0, 1), d3 = new Date(2026, 0, 4);
    const { days, tss } = buildDailyTss([{ date: d0, tss: 60 }, { date: d3, tss: 40 }], d3);
    expect(days).toHaveLength(4);
    expect(tss).toEqual([60, 0, 0, 40]);
  });
  it("sčíta viac jázd v ten istý deň", () => {
    const d = new Date(2026, 0, 1);
    const { tss } = buildDailyTss([{ date: d, tss: 30 }, { date: d, tss: 20 }], d);
    expect(tss).toEqual([50]);
  });
});

describe("classify", () => {
  it("málo dát", () => {
    expect(classify({ ctl: 0.4, tsb: 0, ramp: 0 }).key).toBe("nodata");
  });
  it("preťaženie pri veľmi zápornej forme", () => {
    expect(classify({ ctl: 50, tsb: -35, ramp: 1 }).key).toBe("strained");
  });
  it("produktívny pri rastúcej kondícii", () => {
    expect(classify({ ctl: 40, tsb: -5, ramp: 5 }).key).toBe("productive");
  });
  it("čerstvá forma pri kladnej forme", () => {
    expect(classify({ ctl: 40, tsb: 12, ramp: 0 }).key).toBe("fresh");
  });
});

describe("rideDateFromGpx", () => {
  it("vytiahne prvý čas", () => {
    const d = rideDateFromGpx("<gpx><time>2026-06-28T07:30:00Z</time></gpx>");
    expect(d.getUTCFullYear()).toBe(2026);
  });
  it("bez času → null", () => {
    expect(rideDateFromGpx("<gpx></gpx>")).toBeNull();
  });
});
