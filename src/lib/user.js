// Lokálny používateľský profil + jedinečné UID. Zatiaľ bez servera – UID sa
// vygeneruje pri registrácii a uloží do zariadenia; neskôr ho napojíme na účet.
export const USER_KEY = "watt_user";

export const loadUser = () => {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
};

export const saveUser = (u) => {
  try { localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch { /* plný/zakázaný storage */ }
  return u;
};

// Jedinečný identifikátor – natívne UUID, s bezpečným fallbackom.
export const newUid = () =>
  (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function")
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// Vytvorí a uloží nový profil s prideleným UID.
export const createUser = (data) =>
  saveUser({ uid: newUid(), createdAt: Date.now(), ...data });
