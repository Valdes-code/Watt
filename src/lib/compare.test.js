import { describe, it, expect } from "vitest";
import { compareRides, rideSignature, baseName } from "./compare.js";

const gpx = (pts) => `<?xml version="1.0"?>
<gpx version="1.1"><trk><trkseg>
${pts.map(([lat, lon]) => `<trkpt lat="${lat}" lon="${lon}"><ele>200</ele></trkpt>`).join("\n")}
</trkseg></trk></gpx>`;

const A = gpx([[48.1, 17.1], [48.2, 17.2], [48.3, 17.3]]);
const A2 = gpx([[48.1, 17.1], [48.2, 17.2], [48.3, 17.3]]); // rovnaký obsah
const B = gpx([[48.1, 17.1], [48.25, 17.25], [48.4, 17.4]]); // iný priebeh

describe("baseName", () => {
  it("odstráni príponu a koncové (n)", () => {
    expect(baseName("Karvina(2).gpx")).toBe("karvina");
    expect(baseName("Karvina.gpx")).toBe("karvina");
  });
});

describe("rideSignature", () => {
  it("rovnaký obsah → rovnaký podpis", () => {
    expect(rideSignature(A)).toBe(rideSignature(A2));
  });
  it("iný priebeh → iný podpis", () => {
    expect(rideSignature(A)).not.toBe(rideSignature(B));
  });
});

describe("compareRides", () => {
  it("rovnaký obsah aj názov → identical", () => {
    expect(compareRides({ name: "Karvina.gpx", gpx: A }, { name: "Karvina.gpx", gpx: A2 }).relation).toBe("identical");
  });
  it("rovnaký obsah, iný názov → identical (obsah má prednosť)", () => {
    expect(compareRides({ name: "Karvina.gpx", gpx: A }, { name: "Praha.gpx", gpx: A2 }).relation).toBe("identical");
  });
  it("rovnaký názov, iný obsah → same-name", () => {
    const r = compareRides({ name: "Karvina.gpx", gpx: A }, { name: "Karvina(2).gpx", gpx: B });
    expect(r.relation).toBe("same-name");
    expect(r.identical).toBe(false);
    expect(r.sameName).toBe(true);
  });
  it("iný názov aj obsah → different", () => {
    expect(compareRides({ name: "Karvina.gpx", gpx: A }, { name: "Praha.gpx", gpx: B }).relation).toBe("different");
  });
});
