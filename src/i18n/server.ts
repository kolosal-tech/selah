import { cookies } from "next/headers";
import { COOKIE_LOCALE, estLocale, LOCALE_PAR_DEFAUT, type Locale } from "./config";
import { MESSAGES, type Messages } from "./messages";

/**
 * Locale côté serveur. Le proxy pose toujours le cookie (géo-IP puis
 * Accept-Language) : l'absence de cookie n'arrive qu'en dehors de son
 * matcher, où le défaut suffit.
 */
export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const brut = jar.get(COOKIE_LOCALE)?.value;
  return estLocale(brut) ? brut : LOCALE_PAR_DEFAUT;
}

export async function getMessages(): Promise<Messages> {
  return MESSAGES[await getLocale()];
}
