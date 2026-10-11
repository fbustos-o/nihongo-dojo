import { readTime, type Reading } from '../../engine';
import type { ItemKind } from '../../state/progressSchema';
import { pickOne, pickWeighted, type Rng } from '../numbers/random';

export const CLOCK_ITEM_KIND: ItemKind = 'word';

/** Hour hand angle in degrees clockwise from 12 (moves with the minutes). */
export const hourAngle = (h: number, m: number): number => (((h % 12) + m / 60) * 30) % 360;
/** Minute hand angle in degrees clockwise from 12. */
export const minuteAngle = (m: number): number => (m % 60) * 6;

/** End point of a hand of `length` from the centre, for an angle clockwise from 12. */
export function handPoint(angle: number, length: number, cx = 100, cy = 100): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180;
  return { x: cx + length * Math.sin(rad), y: cy - length * Math.cos(rad) };
}

export interface ClockTime {
  /** 1..12 */
  h: number;
  /** 0..59 */
  m: number;
}

export const pad2 = (n: number): string => String(n).padStart(2, '0');
export const timeText = ({ h, m }: ClockTime): string => `${h}:${pad2(m)}`;
export const timeItemId = ({ h, m }: ClockTime): string => `time:${h}:${m}`;
export const sameTime = (a: ClockTime, b: ClockTime): boolean => a.h % 12 === b.h % 12 && a.m === b.m;
export const readClock = ({ h, m }: ClockTime): Reading => readTime(h, m);

/** Difficulty tier: 0 o'clock, 1 half hours, 2 5-minute steps, 3 any minute. */
export { tierForRound as clockTierForRound } from '../numbers/numbersLogic';

const IRREGULAR_HOURS = [4, 7, 9];
/** Last digit of minutes read with ぷん / sokuon (1, 3, 4, 6, 8, 10, 20…). */
const IRREGULAR_MINUTE_DIGITS = [0, 1, 3, 4, 6, 8];

export function randomClockTime(tier: number, rng: Rng): ClockTime {
  const h = pickWeighted(rng, Array.from({ length: 12 }, (_, i) => i + 1), (v) => (IRREGULAR_HOURS.includes(v) ? 3 : 1));
  let m: number;
  if (tier <= 0) m = 0;
  else if (tier === 1) m = pickOne(rng, [0, 30]);
  else if (tier === 2) m = pickWeighted(rng, [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55], (v) => (v === 10 ? 3 : 1));
  else m = pickWeighted(rng, Array.from({ length: 60 }, (_, i) => i), (v) => (IRREGULAR_MINUTE_DIGITS.includes(v % 10) ? 3 : 1));
  return { h, m };
}

/** Times that are easy to confuse with `t` (for distractors). */
export function relatedTimes(t: ClockTime): ClockTime[] {
  const wrap = (h: number) => ((h + 11) % 12) + 1;
  const out: ClockTime[] = [
    { h: wrap(t.h + 1), m: t.m },
    { h: wrap(t.h - 1), m: t.m },
    { h: t.h, m: t.m === 0 ? 30 : 0 },
    { h: t.h, m: (t.m + 5) % 60 },
    { h: t.h, m: (t.m + 55) % 60 },
    { h: t.h, m: (t.m + 1) % 60 },
  ];
  return out.filter((o) => !sameTime(o, t));
}

export const stepHour = (h: number, delta: number): number => ((((h - 1 + delta) % 12) + 12) % 12) + 1;
export const stepMinute = (m: number, delta: number): number => (((m + delta) % 60) + 60) % 60;

export interface ClockQuestion {
  kind: 'read' | 'set';
  id: string;
  itemId: string;
  time: ClockTime;
  reading: Reading;
  format: 'type' | 'choice';
  related: string[];
  label: string;
}

/** `time:4:30` -> {h: 4, m: 30}; null when the id is not a valid time id. */
export function parseTimeItemId(itemId: string): ClockTime | null {
  const match = /^time:(\d{1,2}):(\d{1,2})$/.exec(itemId);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h >= 1 && h <= 12 && m <= 59 ? { h, m } : null;
}

/** `fixed` makes the question about exactly that time (review of a due `time:h:m` item). */
export function makeClockQuestion(kind: ClockQuestion['kind'], tier: number, rng: Rng, fixed?: ClockTime): ClockQuestion {
  const time = fixed ?? randomClockTime(tier, rng);
  const reading = readClock(time);
  const itemId = timeItemId(time);
  return {
    kind,
    id: itemId,
    itemId,
    time,
    reading,
    format: rng() < 0.35 ? 'choice' : 'type',
    related: relatedTimes(time).map((t) => readClock(t).kana),
    label: `${timeText(time)} → ${reading.kana}`,
  };
}
