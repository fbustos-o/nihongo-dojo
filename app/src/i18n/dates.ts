import type { Lang } from '../state/progressSchema';
import { getLang, localeOf, translate } from './index';

/** Month name (1-12) in `lang`, from Intl (`marzo`, `March`). Independent of the time zone. */
export function monthName(month: number, lang: Lang = getLang()): string {
  return new Intl.DateTimeFormat(localeOf(lang), { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, month - 1, 15)));
}

/** Weekday name; 0 = Sunday like `Date#getDay`. */
export function weekdayName(weekday: number, lang: Lang = getLang()): string {
  // 2026-01-04 is a Sunday
  return new Intl.DateTimeFormat(localeOf(lang), { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 4 + weekday)));
}

/** Short weekday heading (`Dom`, `Sun`); 0 = Sunday. */
export function weekdayShort(weekday: number, lang: Lang = getLang()): string {
  const text = new Intl.DateTimeFormat(localeOf(lang), { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 4 + weekday)));
  const clean = text.replace(/\.$/, '');
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

const INITIALS: Record<Lang, readonly string[]> = {
  es: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
  en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
};

/** One-letter weekday (D L M X J V S / S M T W T F S); 0 = Sunday. */
export const weekdayInitial = (weekday: number, lang: Lang = getLang()): string => INITIALS[lang][weekday]!;

/** «14 de marzo» / «March 14». */
export const formatMonthDay = (month: number, day: number, lang: Lang = getLang()): string =>
  translate(lang, 'memory.dateLabel', { day, month: monthName(month, lang) });
