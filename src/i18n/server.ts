import { cookies } from "next/headers";
import { COOKIE_LOCALE, estLocale, LOCALE_PAR_DEFAUT, type Locale } from "./config";
import { MESSAGES, type Messages } from "./messages";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Locale côté serveur. Le proxy pose toujours le cookie (géo-IP puis
 * Accept-Language) : l'absence de cookie n'arrive qu'en dehors de son matcher,
 * ou quand un membre revient depuis un appareil neuf.
 *
 * Dans ce dernier cas, `profiles.lang` — écrite à chaque changement de langue —
 * fait autorité sur le défaut. Sans cette reprise, la colonne était écrite mais
 * jamais lue : un membre ayant choisi le coréen retombait en français sur un
 * nouvel appareil. `profiles.locale` reste la trace figée de l'inscription et
 * n'est volontairement pas consultée ici (voir ADR-0003).
 */
export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const brut = jar.get(COOKIE_LOCALE)?.value;
  if (estLocale(brut)) return brut;

  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return LOCALE_PAR_DEFAUT;
    const { data: profile } = await supabase
      .from("profiles")
      .select("lang")
      .eq("id", user.id)
      .maybeSingle();
    return estLocale(profile?.lang) ? profile.lang : LOCALE_PAR_DEFAUT;
  } catch {
    // Une panne de base ne doit jamais empêcher une page de se rendre : le
    // défaut est une dégradation acceptable, une exception ne l'est pas.
    return LOCALE_PAR_DEFAUT;
  }
}

export async function getMessages(): Promise<Messages> {
  return MESSAGES[await getLocale()];
}
