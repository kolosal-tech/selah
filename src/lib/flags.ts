/**
 * Interrupteurs produit.
 *
 * Le repli documenté jusqu'ici en cas d'incident était une migration SQL
 * (`0015` suspend, `0016` réactive) : un changement de schéma là où une variable
 * suffit. Ces flags donnent un interrupteur sans migration et sans requête.
 *
 * Limite assumée : une variable Vercel n'agit qu'après redéploiement (~2 min).
 * Un flag à chaud imposerait une lecture en base à chaque rendu, soit un
 * aller-retour de plus par navigation en plus des `auth.getUser()` existants.
 * Arbitrage consigné dans `docs/adr/ADR-0009-feature-flags.md`.
 */

export const FEATURE_FLAGS = [
  "mentorship",
  "video_publication",
  "analytics",
] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

/** Défauts identiques aux constantes qu'ils remplacent : aucun changement de comportement. */
const DEFAUTS: Record<FeatureFlag, boolean> = {
  mentorship: true,
  video_publication: true,
  analytics: false,
};

/**
 * Accès statiques à `process.env` : Next remplace ces expressions à la
 * compilation, ce qu'une indexation dynamique `process.env[cle]` empêcherait.
 */
function valeurBrute(flag: FeatureFlag): string | undefined {
  switch (flag) {
    case "mentorship":
      return process.env.SELAH_FLAG_MENTORSHIP;
    case "video_publication":
      return process.env.SELAH_FLAG_VIDEO_PUBLICATION;
    case "analytics":
      return process.env.SELAH_FLAG_ANALYTICS;
  }
}

/**
 * Grammaire volontairement étroite : `1`/`true` activent, `0`/`false`
 * désactivent, tout le reste retombe sur le défaut. Une faute de frappe dans
 * une variable d'environnement ne doit pas ouvrir une fonctionnalité fermée.
 */
export function isEnabled(flag: FeatureFlag): boolean {
  const brut = valeurBrute(flag)?.trim().toLowerCase();
  if (brut === "1" || brut === "true") return true;
  if (brut === "0" || brut === "false") return false;
  return DEFAUTS[flag];
}
