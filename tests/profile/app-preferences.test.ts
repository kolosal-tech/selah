import { afterEach, describe, expect, it, vi } from "vitest";
import {
  APP_PREFERENCES_EVENT,
  DEFAULT_PREFERENCES,
  readAppPreferences,
  saveAppPreferences,
  subscribeAppPreferences,
  updateAppPreference,
} from "@/lib/app-preferences";

const storage = new Map<string, string>();

function installBrowser() {
  const listeners = new Map<string, Set<EventListener>>();
  const windowMock = {
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      const values = listeners.get(type) ?? new Set<EventListener>();
      values.add(listener);
      listeners.set(type, values);
    }),
    removeEventListener: vi.fn((type: string, listener: EventListener) => listeners.get(type)?.delete(listener)),
    dispatchEvent: vi.fn((event: Event) => {
      listeners.get(event.type)?.forEach((listener) => listener(event));
      return true;
    }),
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: windowMock });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { documentElement: { dataset: {} } } });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
}

afterEach(() => {
  storage.clear();
  vi.unstubAllGlobals();
});

describe("préférences de l'application", () => {
  it("reste silencieuse et immobile par défaut", () => {
    expect(readAppPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it("persiste les trois choix et notifie cet onglet immédiatement", () => {
    installBrowser();
    const callback = vi.fn();
    const unsubscribe = subscribeAppPreferences(callback);

    saveAppPreferences({ feedSound: true, ambience: true, reducedMotion: true });

    expect(readAppPreferences()).toEqual({ feedSound: true, ambience: true, reducedMotion: true });
    expect(document.documentElement.dataset.reducedMotion).toBe("true");
    expect(window.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: APP_PREFERENCES_EVENT }));
    expect(callback).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("met à jour un seul choix sans écraser les autres", () => {
    installBrowser();
    saveAppPreferences({ feedSound: true, ambience: false, reducedMotion: true });

    updateAppPreference("ambience", true);

    expect(readAppPreferences()).toEqual({ feedSound: true, ambience: true, reducedMotion: true });
  });
});
