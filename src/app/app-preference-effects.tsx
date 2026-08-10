"use client";

import { useEffect } from "react";
import { readAppPreferences, subscribeAppPreferences } from "@/lib/app-preferences";

function applyDocumentPreferences() {
  const { reducedMotion } = readAppPreferences();
  document.documentElement.dataset.reducedMotion = reducedMotion ? "true" : "false";
}

/** Réapplique les préférences locales sur toutes les pages et entre onglets. */
export function AppPreferenceEffects() {
  useEffect(() => {
    applyDocumentPreferences();
    return subscribeAppPreferences(applyDocumentPreferences);
  }, []);

  return null;
}
