import { describe, it, expect, beforeEach } from "vitest";
import { uniqueName, pushHistory, importHistoryEntries, loadHistory } from "./history.js";

// Jednoduchý in-memory localStorage pre node prostredie.
beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
});

const ride = (km = 10) => ({ distanceKm: km, planned: false });

describe("uniqueName", () => {
  it("nezmení názov, ak nie je obsadený", () => {
    expect(uniqueName("Karvina.gpx", new Set())).toBe("Karvina.gpx");
  });

  it("pridá (2) pri prvej zhode", () => {
    expect(uniqueName("Karvina.gpx", new Set(["Karvina.gpx"]))).toBe("Karvina(2).gpx");
  });

  it("preskočí obsadené čísla na (3)", () => {
    const taken = new Set(["Karvina.gpx", "Karvina(2).gpx"]);
    expect(uniqueName("Karvina.gpx", taken)).toBe("Karvina(3).gpx");
  });

  it("číslovanie odvodí z holého základu, ak názov už má (n)", () => {
    const taken = new Set(["Karvina.gpx", "Karvina(2).gpx"]);
    expect(uniqueName("Karvina(2).gpx", taken)).toBe("Karvina(3).gpx");
  });

  it("zvládne názov bez prípony", () => {
    expect(uniqueName("Trasa", new Set(["Trasa"]))).toBe("Trasa(2)");
  });
});

describe("pushHistory – číslovanie pri zhode názvu", () => {
  it("rovnaký obsah sa nezdvojuje (len posun navrch)", () => {
    pushHistory("Karvina.gpx", "<gpx>A</gpx>", ride());
    pushHistory("Karvina.gpx", "<gpx>A</gpx>", ride());
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].name).toBe("Karvina.gpx");
  });

  it("rovnaký názov + iný obsah → Karvina(2), Karvina(3)", () => {
    pushHistory("Karvina.gpx", "<gpx>A</gpx>", ride());
    pushHistory("Karvina.gpx", "<gpx>B</gpx>", ride());
    pushHistory("Karvina.gpx", "<gpx>C</gpx>", ride());
    const names = loadHistory().map((e) => e.name).sort();
    expect(names).toEqual(["Karvina(2).gpx", "Karvina(3).gpx", "Karvina.gpx"]);
  });
});

describe("importHistoryEntries", () => {
  it("zlúči, dedupne podľa obsahu a očísluje kolidujúce názvy", () => {
    pushHistory("Karvina.gpx", "<gpx>A</gpx>", ride());
    const next = importHistoryEntries([
      { name: "Karvina.gpx", gpx: "<gpx>A</gpx>", ts: 5 }, // duplicitný obsah → preskočí
      { name: "Karvina.gpx", gpx: "<gpx>B</gpx>", ts: 6 }, // nový obsah, zhodný názov → (2)
    ]);
    const names = next.map((e) => e.name).sort();
    expect(names).toEqual(["Karvina(2).gpx", "Karvina.gpx"]);
    expect(next).toHaveLength(2);
  });

  it("odmietne nepole", () => {
    expect(() => importHistoryEntries(null)).toThrow();
  });
});
