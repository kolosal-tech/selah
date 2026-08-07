"use client";

import { useEffect } from "react";

/** Enregistre le service worker (mode Lite hors ligne). Aucun rendu. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Enregistrement refusé (navigation privée, HTTP) : l'app reste
      // pleinement fonctionnelle en ligne. Rien à signaler à l'utilisateur.
    });
  }, []);
  return null;
}
