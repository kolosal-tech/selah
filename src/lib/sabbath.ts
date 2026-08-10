/** Mode Sabbat : 12 h de déconnexion volontaire. Logique pure, testée. */

export const SABBATH_HOURS = 12;

export function sabbathEnd(from: Date = new Date()): Date {
  return new Date(from.getTime() + SABBATH_HOURS * 3600 * 1000);
}

export function isSabbathActive(
  sabbathUntil: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!sabbathUntil) return false;
  const until = new Date(sabbathUntil);
  return !Number.isNaN(until.getTime()) && until.getTime() > now.getTime();
}

export function sabbathRemainingLabel(
  sabbathUntil: string,
  now: Date = new Date(),
): string {
  const ms = new Date(sabbathUntil).getTime() - now.getTime();
  if (ms <= 0) return "terminé";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}
