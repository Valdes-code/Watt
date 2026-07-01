import { describe, it, expect, beforeEach } from "vitest";
import { loadUser, saveUser, createUser, newUid } from "./user.js";

beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
});

describe("newUid", () => {
  it("vráti neprázdny reťazec", () => {
    expect(typeof newUid()).toBe("string");
    expect(newUid().length).toBeGreaterThan(0);
  });
  it("dve volania dajú rôzne UID", () => {
    expect(newUid()).not.toBe(newUid());
  });
});

describe("createUser / loadUser", () => {
  it("vytvorí profil s UID a uloží ho", () => {
    const u = createUser({ nick: "Janko", riderKg: 80 });
    expect(u.uid).toBeTruthy();
    expect(u.nick).toBe("Janko");
    expect(u.riderKg).toBe(80);
    expect(typeof u.createdAt).toBe("number");
    expect(loadUser().uid).toBe(u.uid);
  });

  it("loadUser je null, kým nie je registrácia", () => {
    expect(loadUser()).toBeNull();
  });

  it("saveUser prepíše profil", () => {
    createUser({ nick: "A" });
    saveUser({ uid: "x", nick: "B" });
    expect(loadUser().nick).toBe("B");
  });
});
