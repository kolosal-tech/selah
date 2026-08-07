/** Streak spirituel — même règle que public.touch_streak côté SQL. Logique pure, testée. */

export interface StreakState {
  days: number;
  lastDay: string | null; // ISO date "YYYY-MM-DD"
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayDiff(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000,
  );
}

/** Applique une action du jour `today` à un état de streak. */
export function touchStreak(state: StreakState, today: string): StreakState {
  if (state.lastDay === today) return state;
  if (state.lastDay && dayDiff(state.lastDay, today) === 1) {
    return { days: state.days + 1, lastDay: today };
  }
  return { days: 1, lastDay: today };
}
