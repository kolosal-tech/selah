"use client";

import { useEffect } from "react";

/** Enregistre le service worker (mode Lite hors ligne). Aucun rendu. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Pas de service worker en développement : les fragments de `next dev` ne
    // portent pas d'empreinte de contenu, donc la stratégie « cache d'abord »
    // resservirait indéfiniment l'ancien CSS après une modification.
    // `next build && next start` reste le moyen de tester le mode hors ligne.
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Enregistrement refusé (navigation privée, HTTP) : l'app reste
      // pleinement fonctionnelle en ligne. Rien à signaler à l'utilisateur.
    });
  }, []);
  return null;
}
