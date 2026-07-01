// Lokálny používateľský profil + jedinečné UID. Zatiaľ bez servera – UID sa
// vygeneruje pri registrácii a uloží do zariadenia; neskôr ho napojíme na účet.
export const USER_KEY = "watt_user";

// Jedinečný identifikátor účtu – natívne UUID, s bezpečným fallbackom.
export const newUid = () =>
  (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function")
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const newBikeId = () => `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

// Doplní chýbajúce/staré polia (migrácia): bicykle ako pole + aktívny bicykel.
export const normalizeUser = (u) => {
  if (!u) return u;
  let bikes = Array.isArray(u.bikes) ? u.bikes : null;
  if (!bikes || bikes.length === 0) {
    bikes = [{ id: newBikeId(), name: u.bikeName || "Bicykel 1", weightKg: Number(u.bikeKg) || 8.5 }];
  }
  let activeBikeId = u.activeBikeId;
  if (!activeBikeId || !bikes.some((b) => b.id === activeBikeId)) activeBikeId = bikes[0].id;
  return { ...u, bikes, activeBikeId };
};

// Aktuálne zvolený bicykel.
export const activeBike = (u) =>
  u?.bikes?.find((b) => b.id === u.activeBikeId) || u?.bikes?.[0] || null;

export const loadUser = () => {
  try {
    const u = JSON.parse(localStorage.getItem(USER_KEY));
    return u ? normalizeUser(u) : null;
  } catch { return null; }
};

export const saveUser = (u) => {
  try { localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch { /* plný/zakázaný storage */ }
  return u;
};

// Vytvorí a uloží nový profil s prideleným UID (vrátane prvého bicykla).
export const createUser = (data) =>
  saveUser(normalizeUser({ uid: newUid(), createdAt: Date.now(), ...data }));
