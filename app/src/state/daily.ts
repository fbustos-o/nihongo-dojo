import { z } from 'zod';
import { localDateString } from './streak';

/** Activity of one calendar day (local date). */
export const DailyEntrySchema = z.object({
  /** Answers to items that were due (SRS reviews). */
  reviews: z.number().int().min(0).default(0),
  /** Lessons passed. */
  lessons: z.number().int().min(0).default(0),
  correct: z.number().int().min(0).default(0),
  wrong: z.number().int().min(0).default(0),
});
export type DailyEntry = z.infer<typeof DailyEntrySchema>;

/** `YYYY-MM-DD` -> activity. Optional in saved progress: old saves load with `{}`. */
export const DailySchema = z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), DailyEntrySchema);
export type Daily = z.infer<typeof DailySchema>;

/** Days kept in the store. */
export const DAILY_KEEP_DAYS = 90;

export const emptyDaily = (): DailyEntry => ({ reviews: 0, lessons: 0, correct: 0, wrong: 0 });

/** Adds `delta` to the counters of `now`'s day and drops entries older than `DAILY_KEEP_DAYS`. */
export function bumpDaily(daily: Daily, now: Date, delta: Partial<DailyEntry>): Daily {
  const key = localDateString(now);
  const current = daily[key] ?? emptyDaily();
  const next: Daily = {
    ...daily,
    [key]: {
      reviews: current.reviews + (delta.reviews ?? 0),
      lessons: current.lessons + (delta.lessons ?? 0),
      correct: current.correct + (delta.correct ?? 0),
      wrong: current.wrong + (delta.wrong ?? 0),
    },
  };
  const oldest = new Date(now);
  oldest.setDate(now.getDate() - DAILY_KEEP_DAYS);
  const limit = localDateString(oldest);
  for (const date of Object.keys(next)) if (date < limit) delete next[date];
  return next;
}

export const dailyAccuracy = (entry: DailyEntry): number => {
  const total = entry.correct + entry.wrong;
  return total === 0 ? 0 : entry.correct / total;
};

/** Spanish weekday initials, Sunday first (Date#getDay order): D L M X J V S. */
export const WEEKDAY_INITIALS_ES = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const;

export interface DayCell {
  date: string;
  /** D L M X J V S */
  label: string;
  active: boolean;
  today: boolean;
}

const hasActivity = (e: DailyEntry | undefined): boolean => !!e && e.reviews + e.lessons + e.correct + e.wrong > 0;

/**
 * The last 7 days ending today (oldest first). A day is active when it has recorded activity or falls inside
 * the current streak (saves from before daily tracking only have the streak).
 */
export function lastSevenDays(daily: Daily, streak: { lastStudyDate: string | null; count: number }, now: Date): DayCell[] {
  const streakDays = new Set<string>();
  if (streak.lastStudyDate && streak.count > 0) {
    const [y, m, d] = streak.lastStudyDate.split('-').map(Number) as [number, number, number];
    for (let i = 0; i < streak.count; i++) streakDays.add(localDateString(new Date(y, m - 1, d - i)));
  }
  const today = localDateString(now);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    const date = localDateString(day);
    return { date, label: WEEKDAY_INITIALS_ES[day.getDay()]!, active: hasActivity(daily[date]) || streakDays.has(date), today: date === today };
  });
}
