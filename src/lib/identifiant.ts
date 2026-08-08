/**
 * Du nom qu'on se donne à l'identifiant technique.
 *
 * On demandait un « nom d'utilisateur » avec des règles de machine :
 * minuscules, pas d'accent, pas d'espace, pas d'apostrophe. Résultat, une
 * personne qui s'appelle Aïcha, Zoé ou Marie-Claire se faisait refuser à
 * l'inscription. Le nom affiché est maintenant libre ; l'identifiant en
 * est dérivé ici, sans rien demander à personne.
 */

/** Le nom affiché : ce que la personne tape, débarrassé du superflu. */
export function nettoyerNomAffiche(brut: string): string {
  return brut.trim().replace(/\s+/g, " ").slice(0, 40);
}

/**
 * Nom affiché valide ? Deux signes visibles suffisent. On refuse ce qui
 * n'est pas un nom : chaînes vides, suites de ponctuation, adresses e-mail
 * collées par erreur dans le mauvais champ.
 */
export function nomAfficheValide(nom: string): boolean {
  const n = nettoyerNomAffiche(nom);
  if (n.length < 2 || n.length > 40) return false;
  if (n.includes("@")) return false;
  // Au moins deux caractères alphanumériques, toutes écritures confondues.
  const signes = [...n].filter((c) => /[\p{L}\p{N}]/u.test(c));
  return signes.length >= 2;
}

/**
 * Identifiant technique dérivé du nom affiché : minuscules, ASCII,
 * underscores. Les accents sont dépouillés (« Aïcha » → « aicha ») ;
 * une écriture non latine ne laisse rien de lisible, on rend alors une
 * chaîne vide et l'appelant retombe sur un identifiant neutre.
 */
export function identifiantDepuisNom(nom: string): string {
  const base = nettoyerNomAffiche(nom)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // diacritiques
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30)
    .replace(/_+$/, "");
  return base.length >= 3 ? base : "";
}

/** Identifiant neutre quand le nom ne donne rien d'exploitable en ASCII. */
export function identifiantNeutre(graine: string): string {
  return `disciple_${graine.replace(/[^a-z0-9]/gi, "").slice(0, 6).toLowerCase()}`;
}
