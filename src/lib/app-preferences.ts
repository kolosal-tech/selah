export type AppPreferences = {
  feedSound: boolean;
  ambience: boolean;
  reducedMotion: boolean;
};

export const APP_PREFERENCES_EVENT = "selah:preferences-changed";

const DEFAULT_PREFERENCES: AppPreferences = Object.freeze({
  feedSound: false,
  ambience: false,
  reducedMotion: false,
});

const STORAGE_KEYS: Record<keyof AppPreferences, string> = {
  feedSound: "selah:son-active",
  ambience: "selah:ambiance",
  reducedMotion: "selah:animations-reduites",
};

function isBrowser() {
  return typeof window !== "undefined";
}

let cachedPreferences = DEFAULT_PREFERENCES;
let cachedSignature = "0:0:0";

function cachePreferences(preferences: AppPreferences): AppPreferences {
  const signature = `${Number(preferences.feedSound)}:${Number(preferences.ambience)}:${Number(preferences.reducedMotion)}`;
  if (signature === cachedSignature) return cachedPreferences;
  cachedSignature = signature;
  cachedPreferences = Object.freeze({ ...preferences });
  return cachedPreferences;
}

/** Lit des choix volontairement silencieux si le stockage est indisponible. */
export function readAppPreferences(): AppPreferences {
  if (!isBrowser()) return DEFAULT_PREFERENCES;
  try {
    return cachePreferences({
      feedSound: localStorage.getItem(STORAGE_KEYS.feedSound) === "1",
      ambience: localStorage.getItem(STORAGE_KEYS.ambience) === "1",
      reducedMotion: localStorage.getItem(STORAGE_KEYS.reducedMotion) === "1",
    });
  } catch {
    return cachedPreferences;
  }
}

/** Persiste un choix puis notifie immédiatement les composants du même onglet. */
export function saveAppPreferences(preferences: AppPreferences) {
  if (!isBrowser()) return;
  const normalized = cachePreferences(preferences);
  try {
    (Object.keys(STORAGE_KEYS) as Array<keyof AppPreferences>).forEach((key) => {
      localStorage.setItem(STORAGE_KEYS[key], normalized[key] ? "1" : "0");
    });
  } catch {
    // Le choix reste actif dans les composants abonnés de l'onglet courant.
  }
  document.documentElement.dataset.reducedMotion = normalized.reducedMotion ? "true" : "false";
  window.dispatchEvent(new CustomEvent(APP_PREFERENCES_EVENT, { detail: normalized }));
}

export function updateAppPreference<Key extends keyof AppPreferences>(key: Key, value: AppPreferences[Key]) {
  saveAppPreferences({ ...readAppPreferences(), [key]: value });
}

export function subscribeAppPreferences(callback: () => void) {
  if (!isBrowser()) return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || Object.values(STORAGE_KEYS).includes(event.key)) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(APP_PREFERENCES_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(APP_PREFERENCES_EVENT, callback);
  };
}

export { DEFAULT_PREFERENCES, STORAGE_KEYS };
