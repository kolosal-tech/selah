import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isEnabled } from "@/lib/flags";
import type { ProductEventSurface } from "@/lib/analytics/events";

/**
 * Voie anonyme : les événements qu'aucun compte authentifié ne peut signaler.
 *
 * Un échec de connexion, un échec d'inscription ou une métrique terrain
 * naissent avant toute session. `product_events` ne peut pas les porter, son
 * `actor_id` étant NOT NULL. Cette voie écrit dans une table **sans acteur**,
 * donc sans donnée personnelle, même pseudonyme.
 *
 * Le jeton ne quitte jamais le serveur. Il n'est pas un `service_role` : il
 * n'autorise que l'insertion d'une ligne de compteur. Voir
 * `docs/adr/ADR-0010-voie-anonyme-et-rum.md`.
 */

export const ANONYMOUS_EVENT_NAMES = [
  "login_failed",
  "signup_failed",
  "password_reset_requested",
  "web_vital",
] as const;

export const WEB_VITAL_METRICS = ["lcp", "inp", "cls"] as const;
export const WEB_VITAL_BUCKETS = ["good", "needs_improvement", "poor"] as const;

export type AnonymousEventName = (typeof ANONYMOUS_EVENT_NAMES)[number];
export type WebVitalMetric = (typeof WEB_VITAL_METRICS)[number];
export type WebVitalBucket = (typeof WEB_VITAL_BUCKETS)[number];

export type AnonymousEvent =
  | { name: Exclude<AnonymousEventName, "web_vital">; surface: ProductEventSurface }
  | {
      name: "web_vital";
      surface: ProductEventSurface;
      metric: WebVitalMetric;
      bucket: WebVitalBucket;
    };

/**
 * Seuils terrain de web.dev. La valeur brute n'est jamais transmise : trois
 * paliers suffisent à piloter, là où une mesure au millimètre contribuerait à
 * distinguer un appareil.
 */
const SEUILS: Record<WebVitalMetric, { bon: number; mauvais: number }> = {
  lcp: { bon: 2500, mauvais: 4000 },
  inp: { bon: 200, mauvais: 500 },
  cls: { bon: 0.1, mauvais: 0.25 },
};

export function bucketPourVital(
  metric: WebVitalMetric,
  valeur: number,
): WebVitalBucket | null {
  if (!Number.isFinite(valeur) || valeur < 0) return null;
  const { bon, mauvais } = SEUILS[metric];
  if (valeur <= bon) return "good";
  if (valeur <= mauvais) return "needs_improvement";
  return "poor";
}

export async function recordAnonymousEvent(
  supabase: SupabaseClient,
  event: AnonymousEvent,
): Promise<void> {
  if (!isEnabled("analytics_anonymous")) return;
  const token = process.env.SELAH_ANALYTICS_TOKEN;
  // Sans jeton, la RPC refuserait de toute façon : ne pas faire l'aller-retour.
  if (!token) return;
  try {
    await supabase.rpc("record_anonymous_event", {
      p_token: token,
      p_name: event.name,
      p_surface: event.surface,
      p_metric: event.name === "web_vital" ? event.metric : null,
      p_bucket: event.name === "web_vital" ? event.bucket : null,
    });
  } catch {
    // Une mesure ne casse jamais un parcours, et ne journalise rien.
  }
}

export function recordAnonymousEventAfter(
  supabase: SupabaseClient,
  event: AnonymousEvent,
): void {
  if (!isEnabled("analytics_anonymous")) return;
  after(() => recordAnonymousEvent(supabase, event));
}
