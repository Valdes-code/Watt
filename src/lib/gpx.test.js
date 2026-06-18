import { describe, it, expect } from "vitest";
import { haversine, parseGpx, analyzeRide, importGpx } from "./gpx.js";
import { SAMPLE_GPX } from "./sampleGpx.js";

const gpx = (body) => `<?xml version="1.0"?>
<gpx version="1.1"><trk><trkseg>
${body}
</trkseg></trk></gpx>`;

describe("haversine", () => {
  it("vráti 0 pre identický bod", () => {
    expect(haversine(48.15, 17.11, 48.15, 17.11)).toBe(0);
  });

  it("zhruba 111 km na stupeň zemepisnej šírky", () => {
    const d = haversine(48, 17, 49, 17);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
});

describe("parseGpx", () => {
  it("vytiahne lat/lon/ele/time", () => {
    const { points } = parseGpx(
      gpx(`
        <trkpt lat="48.10" lon="17.10"><ele>200</ele><time>2026-06-14T07:00:00Z</time></trkpt>
        <trkpt lat="48.11" lon="17.11"><ele>210</ele><time>2026-06-14T07:01:00Z</time></trkpt>`)
    );
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ lat: 48.1, lon: 17.1, ele: 200 });
    expect(points[0].time).toBe(Date.parse("2026-06-14T07:00:00Z"));
  });

  it("rozpozná výkon v <extensions>", () => {
    const { hasPower, points } = parseGpx(
      gpx(`
        <trkpt lat="48.1" lon="17.1"><time>2026-06-14T07:00:00Z</time><extensions><power>250</power></extensions></trkpt>
        <trkpt lat="48.2" lon="17.1"><time>2026-06-14T07:05:00Z</time><extensions><power>260</power></extensions></trkpt>`)
    );
    expect(hasPower).toBe(true);
    expect(points[0].power).toBe(250);
  });

  it("toleruje chýbajúce ele/time", () => {
    const { points } = parseGpx(
      gpx(`
        <trkpt lat="48.1" lon="17.1"></trkpt>
        <trkpt lat="48.2" lon="17.2"></trkpt>`)
    );
    expect(points[0].ele).toBeNull();
    expect(points[0].time).toBeNull();
  });

  it("vyhodí chybu pri prázdnom vstupe a pri jednom bode", () => {
    expect(() => parseGpx("")).toThrow();
    expect(() => parseGpx(gpx(`<trkpt lat="48.1" lon="17.1"></trkpt>`))).toThrow(/trackpoint/i);
  });
});

describe("analyzeRide", () => {
  it("spočíta vzdialenosť, prevýšenie a rýchlosť", () => {
    const { points } = parseGpx(
      gpx(`
        <trkpt lat="48.000" lon="17.000"><ele>200</ele><time>2026-06-14T07:00:00Z</time></trkpt>
        <trkpt lat="48.010" lon="17.000"><ele>250</ele><time>2026-06-14T07:02:00Z</time></trkpt>
        <trkpt lat="48.020" lon="17.000"><ele>230</ele><time>2026-06-14T07:04:00Z</time></trkpt>`)
    );
    const ride = analyzeRide(points);
    // ~1.11 km na úsek -> ~2.22 km
    expect(ride.distanceKm).toBeGreaterThan(2.1);
    expect(ride.distanceKm).toBeLessThan(2.3);
    // stúpanie len +50 m (klesanie -20 sa nepočíta)
    expect(ride.elevationGain).toBe(50);
    expect(ride.durationSec).toBe(240);
    expect(ride.avgSpeedKmh).toBeGreaterThan(0);
    expect(ride.segments).toHaveLength(2);
  });

  it("použije výkon z merača, keď je v súbore", () => {
    const { points } = parseGpx(
      gpx(`
        <trkpt lat="48.0" lon="17.0"><ele>200</ele><time>2026-06-14T07:00:00Z</time><extensions><power>200</power></extensions></trkpt>
        <trkpt lat="48.01" lon="17.0"><ele>200</ele><time>2026-06-14T07:02:00Z</time><extensions><power>300</power></extensions></trkpt>`)
    );
    const ride = analyzeRide(points);
    expect(ride.hasPower).toBe(true);
    expect(ride.segments[0].source).toBe("merač");
    expect(ride.segments[0].power).toBe(250); // priemer 200 a 300
  });

  it("dopočíta výkon z fyziky, keď merač chýba (kladný do kopca)", () => {
    const { points } = parseGpx(
      gpx(`
        <trkpt lat="48.0" lon="17.0"><ele>200</ele><time>2026-06-14T07:00:00Z</time></trkpt>
        <trkpt lat="48.01" lon="17.0"><ele>260</ele><time>2026-06-14T07:03:00Z</time></trkpt>`)
    );
    const ride = analyzeRide(points);
    expect(ride.hasPower).toBe(false);
    expect(ride.segments[0].source).toBe("fyzika");
    expect(ride.segments[0].power).toBeGreaterThan(0);
  });
});

describe("importGpx na ukážkových trasách", () => {
  it("Strava (bez výkonu) – dopočíta reálne čísla", () => {
    const ride = importGpx(SAMPLE_GPX.morning);
    expect(ride.distanceKm).toBeGreaterThan(35);
    expect(ride.distanceKm).toBeLessThan(70);
    expect(ride.hasPower).toBe(false);
    expect(ride.avgPower).toBeGreaterThan(0);
    expect(ride.elevationGain).toBeGreaterThan(0);
  });

  it("Garmin (s výkonom) – použije merač", () => {
    const ride = importGpx(SAMPLE_GPX.garmin);
    expect(ride.hasPower).toBe(true);
    expect(ride.avgPower).toBeGreaterThan(100);
  });
});
