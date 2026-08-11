/**
 * Vocabulaire de modération — miroir des types énumérés de
 * `supabase/migrations/20260811170000_blocages_et_taxonomie.sql`.
 *
 * Ces constantes vivent hors de `src/app/actions.ts` : un module `"use server"`
 * ne peut exporter que des fonctions asynchrones, et le build échoue sinon.
 */

/**
 * Catégories de signalement. Une file de modération se priorise sur un motif,
 * pas sur une chaîne libre — le champ `reason` restait invariablement
 * « signalement utilisateur ».
 */
export const REPORT_CATEGORIES = [
  "spam",
  "harcelement",
  "haine",
  "violence",
  "contenu_sexuel",
  "desinformation",
  "usurpation",
  "hors_sujet",
  "autre",
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

/**
 * Les trois gestes de mise à distance, qui ne se valent pas :
 *
 *   `mute`           — je ne veux plus voir ce compte ; lui ne sait rien.
 *   `block`          — je ne veux plus le voir, et il ne peut plus me suivre.
 *   `not_interested` — je ne le rejette pas, je veux moins le voir.
 */
export const BLOCK_KINDS = ["mute", "block", "not_interested"] as const;

export type BlockKind = (typeof BLOCK_KINDS)[number];

export function estCategorieSignalement(valeur: unknown): valeur is ReportCategory {
  return REPORT_CATEGORIES.includes(valeur as ReportCategory);
}

export function estGesteBlocage(valeur: unknown): valeur is BlockKind {
  return BLOCK_KINDS.includes(valeur as BlockKind);
}
