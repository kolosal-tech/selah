import { afterEach, describe, expect, it, vi } from "vitest";
import { FEATURE_FLAGS, isEnabled } from "@/lib/flags";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isEnabled", () => {
  it("conserve les défauts historiques du produit", () => {
    expect(isEnabled("mentorship")).toBe(true);
    expect(isEnabled("video_publication")).toBe(true);
    // Les deux voies de mesure sont fermées par défaut : elles ne s'activent
    // qu'explicitement, et la voie anonyme exige en plus un jeton serveur.
    expect(isEnabled("analytics")).toBe(false);
    expect(isEnabled("analytics_anonymous")).toBe(false);
  });

  it("accepte les deux écritures d'activation et de désactivation", () => {
    vi.stubEnv("SELAH_FLAG_ANALYTICS", "1");
    expect(isEnabled("analytics")).toBe(true);
    vi.stubEnv("SELAH_FLAG_ANALYTICS", "true");
    expect(isEnabled("analytics")).toBe(true);
    vi.stubEnv("SELAH_FLAG_VIDEO_PUBLICATION", "0");
    expect(isEnabled("video_publication")).toBe(false);
    vi.stubEnv("SELAH_FLAG_VIDEO_PUBLICATION", "false");
    expect(isEnabled("video_publication")).toBe(false);
  });

  it("ignore la casse et les espaces d'une valeur saisie à la main", () => {
    vi.stubEnv("SELAH_FLAG_ANALYTICS", " TRUE ");
    expect(isEnabled("analytics")).toBe(true);
    vi.stubEnv("SELAH_FLAG_MENTORSHIP", "  False ");
    expect(isEnabled("mentorship")).toBe(false);
  });

  it("retombe sur le défaut plutôt que d'ouvrir sur une valeur inconnue", () => {
    // Une faute de frappe dans une variable d'environnement ne doit jamais
    // activer une fonctionnalité fermée.
    for (const valeur of ["", "oui", "yes", "on", "2", "null"]) {
      vi.stubEnv("SELAH_FLAG_ANALYTICS", valeur);
      expect(isEnabled("analytics")).toBe(false);
      vi.stubEnv("SELAH_FLAG_MENTORSHIP", valeur);
      expect(isEnabled("mentorship")).toBe(true);
    }
  });

  it("expose exactement les flags inventoriés", () => {
    expect([...FEATURE_FLAGS]).toEqual([
      "mentorship",
      "video_publication",
      "analytics",
      "analytics_anonymous",
    ]);
  });
});
