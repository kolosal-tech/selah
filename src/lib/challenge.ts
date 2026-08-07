/** Défis communautaires : avancement et fenêtre de validité. Logique pure, testée. */

export interface Challenge {
  days: number;
  starts_on: string; // "YYYY-MM-DD"
}

function jourDiff(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000,
  );
}

/** Numéro du jour courant dans le défi : 1 le premier jour, 0 si pas commencé. */
export function jourDuDefi(c: Challenge, aujourdhui: string): number {
  const ecart = jourDiff(c.starts_on, aujourdhui);
  if (ecart < 0) return 0;
  return Math.min(ecart + 1, c.days);
}

export function defiEnCours(c: Challenge, aujourdhui: string): boolean {
  const ecart = jourDiff(c.starts_on, aujourdhui);
  return ecart >= 0 && ecart < c.days;
}

/** Progression en pourcentage entier, bornée à [0, 100]. */
export function progression(faits: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((faits / total) * 100)));
}
