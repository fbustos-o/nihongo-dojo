import type { Progress } from './progressSchema';

export function localDateString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Registers study activity today: same day keeps the streak, consecutive day extends it, else restarts. */
export function touchStreak(streak: Progress['streak'], now: Date): Progress['streak'] {
  const today = localDateString(now);
  if (streak.lastStudyDate === today) return streak;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const consecutive = streak.lastStudyDate === localDateString(yesterday);
  return { lastStudyDate: today, count: consecutive ? streak.count + 1 : 1 };
}

/** Streak lengths worth celebrating. */
export const STREAK_MILESTONES: readonly number[] = [3, 7, 14, 30, 60, 100, 200, 365];

/** The milestone reached when the streak goes from `prev` to `next`, or null. */
export function streakMilestone(prev: Progress['streak'], next: Progress['streak']): number | null {
  return next.count > prev.count && STREAK_MILESTONES.includes(next.count) ? next.count : null;
}
