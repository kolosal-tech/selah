"use client";

import { useEffect } from "react";

/**
 * Mesure terrain LCP, INP et CLS avec les API natives du navigateur.
 *
 * Aucune dépendance : `PerformanceObserver` suffit, et une bibliothèque de
 * plus alourdirait le premier rendu — exactement ce que cette sonde est censée
 * surveiller. Les valeurs partent en `sendBeacon`, qui survit à la fermeture
 * d'onglet sans retarder la navigation.
 *
 * Rien d'identifiant ne quitte la page : ni URL complète, ni identifiant de
 * session. Seule une surface prise dans une liste fermée accompagne la mesure.
 */

const SURFACES = [
  { prefixe: "/login", surface: "auth" },
  { prefixe: "/signup", surface: "auth" },
  { prefixe: "/forgot-password", surface: "auth" },
  { prefixe: "/reset-password", surface: "auth" },
  { prefixe: "/decouvrir", surface: "discover" },
  { prefixe: "/feed", surface: "feed" },
  { prefixe: "/videos", surface: "videos" },
  { prefixe: "/profile", surface: "profile" },
] as const;

function surfaceCourante(): string {
  const chemin = window.location.pathname;
  const trouve = SURFACES.find((s) => chemin.startsWith(s.prefixe));
  if (trouve) return trouve.surface;
  return chemin === "/" ? "feed" : "session";
}

function envoyer(metric: string, value: number) {
  const corps = JSON.stringify({ metric, value, surface: surfaceCourante() });
  // `sendBeacon` d'abord : il part même si la page se ferme dans la seconde.
  if (navigator.sendBeacon?.(
    "/api/vitals",
    new Blob([corps], { type: "application/json" }),
  )) {
    return;
  }
  void fetch("/api/vitals", {
    method: "POST",
    body: corps,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  }).catch(() => {});
}

export function WebVitals() {
  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return;

    let lcp = 0;
    let cls = 0;
    let inp = 0;
    const observateurs: PerformanceObserver[] = [];

    // `durationThreshold` existe dans le navigateur mais pas dans les types
    // fournis : la signature reste large ici plutôt que d'ignorer la ligne.
    const observer = (
      type: string,
      options: Record<string, unknown>,
      traiter: (entrees: PerformanceEntryList) => void,
    ) => {
      try {
        const o = new PerformanceObserver((liste) => traiter(liste.getEntries()));
        o.observe({ type, ...options } as PerformanceObserverInit);
        observateurs.push(o);
      } catch {
        // Un type non supporté par le navigateur n'est pas une erreur : la
        // métrique manque, le reste continue.
      }
    };

    observer("largest-contentful-paint", { buffered: true }, (entrees) => {
      const derniere = entrees.at(-1);
      if (derniere) lcp = derniere.startTime;
    });

    observer("layout-shift", { buffered: true }, (entrees) => {
      for (const entree of entrees) {
        const decalage = entree as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        };
        // Un décalage consécutif à une interaction est voulu, pas subi.
        if (!decalage.hadRecentInput) cls += decalage.value;
      }
    });

    observer("event", { buffered: true, durationThreshold: 40 }, (entrees) => {
      for (const entree of entrees) {
        const interaction = entree as PerformanceEntry & { interactionId?: number };
        if (interaction.interactionId) inp = Math.max(inp, entree.duration);
      }
    });

    // Un seul envoi par métrique, au moment où la page devient invisible :
    // c'est là que les valeurs sont définitives.
    let envoye = false;
    const finaliser = () => {
      if (envoye || document.visibilityState !== "hidden") return;
      envoye = true;
      if (lcp > 0) envoyer("lcp", lcp);
      if (inp > 0) envoyer("inp", inp);
      envoyer("cls", cls);
      observateurs.forEach((o) => o.disconnect());
    };

    document.addEventListener("visibilitychange", finaliser);
    return () => {
      document.removeEventListener("visibilitychange", finaliser);
      observateurs.forEach((o) => o.disconnect());
    };
  }, []);

  return null;
}
