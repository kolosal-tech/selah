export type FeedCursor = {
  id: string;
  rang_auteur: number;
  score: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Filtre PostgREST de pagination cléset. Le dernier tuple est exclus : le
 * prochain lot est strictement après `(rang_auteur, score desc, id)`.
 */
export function feedCursorFilter(cursor: FeedCursor | undefined): string | null {
  if (!cursor || !UUID.test(cursor.id)) return null;
  if (!Number.isFinite(cursor.rang_auteur) || !Number.isFinite(cursor.score)) return null;
  const rang = String(cursor.rang_auteur);
  const score = String(cursor.score);
  return [
    `rang_auteur.gt.${rang}`,
    `and(rang_auteur.eq.${rang},score.lt.${score})`,
    `and(rang_auteur.eq.${rang},score.eq.${score},id.gt.${cursor.id})`,
  ].join(",");
}
