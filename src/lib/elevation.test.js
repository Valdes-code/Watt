import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchElevations, enrichWithElevation } from "./elevation.js";

const pts = (n) =>
  Array.from({ length: n }, (_, i) => ({ lat: 48 + i * 0.001, lon: 17 + i * 0.001 }));

// Mock odpoveď: výška = index v rámci dávky (na overenie poradia stačí dĺžka).
function mockOk() {
  return vi.fn(async (url) => {
    const lat = new URL(url).searchParams.get("latitude").split(",");
    return { ok: true, json: async () => ({ elevation: lat.map((_, i) => 100 + i) }) };
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchElevations", () => {
  it("prázdny vstup vráti prázdne pole bez volania siete", async () => {
    const fetchMock = mockOk();
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchElevations([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dávkuje po 100 bodoch a zachová poradie/dĺžku", async () => {
    const fetchMock = mockOk();
    vi.stubGlobal("fetch", fetchMock);
    const out = await fetchElevations(pts(250));
    expect(fetchMock).toHaveBeenCalledTimes(3); // 100 + 100 + 50
    expect(out).toHaveLength(250);
    expect(out.every((v) => typeof v === "number")).toBe(true);
  });

  it("vyhodí chybu pri HTTP chybe", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503 })));
    await expect(fetchElevations(pts(2))).rejects.toThrow(/503/);
  });

  it("vyhodí chybu pri nesúlade dĺžky odpovede", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ elevation: [1] }) })));
    await expect(fetchElevations(pts(2))).rejects.toThrow(/odpoveď/i);
  });
});

describe("enrichWithElevation", () => {
  it("doplní výšky do kópie bodov (vstup nemutuje)", async () => {
    vi.stubGlobal("fetch", mockOk());
    const input = pts(3);
    const out = await enrichWithElevation(input);
    expect(out).toHaveLength(3);
    expect(out[0].ele).toBe(100);
    expect(out[0]).toMatchObject({ lat: input[0].lat, lon: input[0].lon });
    expect(input[0].ele).toBeUndefined(); // pôvodné body ostali nedotknuté
  });
});
