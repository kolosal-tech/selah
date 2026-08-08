"use client";

import { createContext, useContext } from "react";
import { LOCALE_PAR_DEFAUT, type Locale } from "./config";
import { MESSAGES, type Messages } from "./messages";

/**
 * Côté client, seul le code de locale traverse la frontière RSC (les
 * dictionnaires contiennent des fonctions de pluriel, non sérialisables).
 * Chaque composant client lit son dictionnaire dans le module partagé.
 */
const LocaleContext = createContext<Locale>(LOCALE_PAR_DEFAUT);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useMessages(): Messages {
  return MESSAGES[useContext(LocaleContext)];
}
