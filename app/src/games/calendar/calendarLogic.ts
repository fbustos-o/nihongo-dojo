import { readDate, readDayOfWeek, type Reading } from '../../engine';
import type { ItemKind } from '../../state/progressSchema';
import { pickOne, pickWeighted, randInt, type Rng } from '../numbers/random';

export const CALENDAR_ITEM_KIND: ItemKind = 'word';
/** Year used for the month grids (any non-leap year works; weekdays follow the real calendar). */
export const YEAR = 2026;

export const SPANISH_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** Index 0 = Sunday, like Date#getDay and readDayOfWeek. */
export const SPANISH_WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export interface DayRef {
  month: number;
  day: number;
}

export const daysInMonth = (month: number): number => new Date(Date.UTC(YEAR, month, 0)).getUTCDate();
/** 0 = Sunday .. 6 = Saturday. */
export const weekdayOf = ({ month, day }: DayRef): number => new Date(Date.UTC(YEAR, month - 1, day)).getUTCDay();
/** Weekday (0-6) of the first day of a month. */
export const firstWeekday = (month: number): number => weekdayOf({ month, day: 1 });

export function shiftDay({ month, day }: DayRef, delta: number): DayRef {
  const d = new Date(Date.UTC(YEAR, month - 1, day + delta));
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Rows of the month grid: 7 columns from Sunday, `null` for empty cells. */
export function monthGrid(month: number): (number | null)[][] {
  const cells: (number | null)[] = [...Array<null>(firstWeekday(month)).fill(null), ...Array.from({ length: daysInMonth(month) }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, r) => cells.slice(r * 7, r * 7 + 7));
}

/** Days with a special reading: 1-10, 14, 20, 24. */
export const SPECIAL_DAYS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 20, 24];
export const isSpecialDay = (day: number): boolean => SPECIAL_DAYS.includes(day);

export function randomDay(rng: Rng): DayRef {
  const month = randInt(rng, 1, 12);
  const day = pickWeighted(rng, Array.from({ length: daysInMonth(month) }, (_, i) => i + 1), (d) => (isSpecialDay(d) ? 3 : 1));
  return { month, day };
}

export type CalendarKind = 'date' | 'weekday' | 'relWeekday' | 'relDate';

export interface CalendarQuestion {
  kind: CalendarKind;
  id: string;
  itemId: string;
  /** The highlighted date (date / weekday), or "today" (relative kinds). */
  today: DayRef;
  /** +1 tomorrow, -1 yesterday (relative kinds). */
  direction: 1 | -1;
  reading: Reading;
  format: 'type' | 'choice';
  related: string[];
  label: string;
}

const weekdayReadings = (except: number): string[] => [0, 1, 2, 3, 4, 5, 6].filter((w) => w !== except).map((w) => readDayOfWeek(w).kana);

export function makeCalendarQuestion(kind: CalendarKind, rng: Rng): CalendarQuestion {
  const q = buildCalendarQuestion(kind, rng);
  const accepted = new Set([q.reading.kana, ...q.reading.alternatives]);
  return { ...q, related: [...new Set(q.related)].filter((r) => !accepted.has(r)) };
}

function buildCalendarQuestion(kind: CalendarKind, rng: Rng): CalendarQuestion {
  let today = randomDay(rng);
  const direction: 1 | -1 = rng() < 0.5 ? 1 : -1;
  const format = rng() < 0.35 ? 'choice' : 'type';
  // Relative questions stay inside the year.
  if (kind === 'relDate' || kind === 'relWeekday') {
    if (today.month === 1 && today.day === 1) today = { month: 1, day: 2 };
    if (today.month === 12 && today.day === 31) today = { month: 12, day: 30 };
  }
  const base = { kind, today, direction, format } as const;
  if (kind === 'date') {
    const reading = readDate(today.month, today.day);
    const nextMonth = today.month === 12 ? 11 : today.month + 1;
    const near = [shiftDay(today, 1), shiftDay(today, -1), { month: nextMonth, day: Math.min(today.day, daysInMonth(nextMonth)) }];
    return {
      ...base,
      id: `date:${today.month}:${today.day}`,
      itemId: `date:${today.month}:${today.day}`,
      reading,
      related: [...near.map((d) => readDate(d.month, d.day).kana), readDate(today.month, pickOne(rng, SPECIAL_DAYS.filter((d) => d <= daysInMonth(today.month)))).kana],
      label: `${today.day} de ${SPANISH_MONTHS[today.month - 1]} → ${reading.kana}`,
    };
  }
  if (kind === 'weekday') {
    const wd = weekdayOf(today);
    const reading = readDayOfWeek(wd);
    return {
      ...base,
      id: `date:${today.month}:${today.day}:wd`,
      itemId: `date:${today.month}:${today.day}:wd`,
      reading,
      related: weekdayReadings(wd),
      label: `${today.day} de ${SPANISH_MONTHS[today.month - 1]} (${SPANISH_WEEKDAYS[wd]}) → ${reading.kana}`,
    };
  }
  if (kind === 'relWeekday') {
    const wd = weekdayOf(today);
    const answerWd = (wd + direction + 7) % 7;
    const reading = readDayOfWeek(answerWd);
    const id = `date:wd:${wd}:${direction > 0 ? 'next' : 'prev'}`;
    return {
      ...base,
      id,
      itemId: id,
      reading,
      related: weekdayReadings(answerWd),
      label: `${direction > 0 ? 'mañana' : 'ayer'} de ${SPANISH_WEEKDAYS[wd]} → ${reading.kana}`,
    };
  }
  const target = shiftDay(today, direction);
  const reading = readDate(target.month, target.day);
  return {
    ...base,
    id: `date:${target.month}:${target.day}`,
    itemId: `date:${target.month}:${target.day}`,
    reading,
    related: [shiftDay(target, 1), shiftDay(target, -1), today].map((d) => readDate(d.month, d.day).kana),
    label: `${direction > 0 ? 'mañana' : 'ayer'}: ${target.day} de ${SPANISH_MONTHS[target.month - 1]} → ${reading.kana}`,
  };
}

export const KIND_LABELS: Record<CalendarKind, string> = {
  date: 'Leer la fecha',
  weekday: 'Día de la semana',
  relWeekday: 'Ayer / mañana (día)',
  relDate: 'Ayer / mañana (fecha)',
};
