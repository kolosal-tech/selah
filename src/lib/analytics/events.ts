/**
 * Catalogue d'événements produit — miroir exact des types énumérés créés par
 * `supabase/migrations/20260811120000_product_analytics.sql`.
 *
 * Règle structurante : ce module ne contient aucun champ de texte libre, aucun
 * `payload`, aucune signature d'index. Écrire le texte d'une prière, un e-mail
 * ou une légende dans la mesure n'est donc pas interdit par convention — c'est
 * impossible à taper. `tests/analytics-catalog.test.ts` verrouille cette
 * propriété et la parité avec le SQL.
 */

export const PRODUCT_EVENT_NAMES = [
  "signup_completed",
  "session_start",
  "first_feed_view",
  "first_publish",
  "first_prayer",
  "room_opened",
  "room_joined",
  "action_refused",
] as const;

export const PRODUCT_EVENT_SURFACES = [
  "session",
  "auth",
  "feed",
  "discover",
  "videos",
  "profile",
  "moderation",
  "post",
  "comment",
  "prayer_request",
  "prayer_action",
  "report",
  "translation",
  "video_publish",
  "video_amen",
  "video_comment",
  "video_prayer",
  "follow",
  "room_create",
  "room_message",
  "challenge_create",
] as const;

export const PRODUCT_EVENT_OUTCOMES = ["ok", "refused", "error"] as const;

export const PRODUCT_EVENT_REASONS = [
  "none",
  "rate_limited",
  "suspended",
  "invalid_input",
  "forbidden",
  "unavailable",
] as const;

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];
export type ProductEventSurface = (typeof PRODUCT_EVENT_SURFACES)[number];
export type ProductEventOutcome = (typeof PRODUCT_EVENT_OUTCOMES)[number];
export type ProductEventReason = (typeof PRODUCT_EVENT_REASONS)[number];

export type ProductEvent = {
  name: ProductEventName;
  surface: ProductEventSurface;
  outcome?: ProductEventOutcome;
  reason?: ProductEventReason;
};
