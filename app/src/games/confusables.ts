import { content } from '../domain/contentLoader';
import type { KanaEntry } from '../domain/schema';
import { shuffle, similarKana } from './kanaUtils';

/**
 * Classic look-alikes. Katakana groups first (the ones every learner mixes up), then
 * katakana <-> hiragana pairs that look almost the same.
 */
export const CONFUSABLE_GROUPS: readonly (readonly string[])[] = [
  ['シ', 'ツ'],
  ['ソ', 'ン'],
  ['ク', 'ケ', 'タ'],
  ['ワ', 'ウ', 'フ'],
  ['ヌ', 'ス'],
  ['チ', 'テ'],
  ['ナ', 'メ'],
  ['コ', 'ユ'],
  ['ノ', 'メ'],
  ['マ', 'ム'],
  ['ア', 'マ'],
  ['ヲ', 'ラ'],
  ['ル', 'レ'],
  ['ミ', 'シ'],
  ['ツ', 'ソ'],
  // katakana <-> hiragana
  ['カ', 'か'],
  ['ヘ', 'へ'],
  ['リ', 'り'],
  ['キ', 'き'],
  ['サ', 'さ'],
  ['ト', 'と'],
  ['ヒ', 'ひ'],
  ['ヤ', 'や'],
  ['ユ', 'ゆ'],
  ['ヨ', 'よ'],
  ['ニ', 'に'],
  ['ス', 'す'],
  ['ム', 'む'],
  ['セ', 'せ'],
  ['ク', 'く'],
];

const PARTNERS = new Map<string, Set<string>>();
for (const group of CONFUSABLE_GROUPS) {
  for (const a of group) {
    for (const b of group) {
      if (a === b) continue;
      if (!PARTNERS.has(a)) PARTNERS.set(a, new Set());
      PARTNERS.get(a)!.add(b);
    }
  }
}

/** Kana commonly confused with `char` (same script and the other script), in no particular order. */
export function confusablesOf(char: string): string[] {
  return [...(PARTNERS.get(char) ?? [])];
}

/** True when `char` has at least one classic look-alike. */
export const hasConfusables = (char: string): boolean => PARTNERS.has(char);

/**
 * Review pool for a katakana lesson: kana already `known` that look like a new kana of the lesson
 * (e.g. シ when the lesson teaches ツ), as entries. Kana already in the lesson are not repeated.
 */
export function confusableReview(
  lessonChars: readonly string[],
  known: ReadonlySet<string>,
  all: readonly KanaEntry[] = content.kana,
): KanaEntry[] {
  const inLesson = new Set(lessonChars);
  const wanted = new Set<string>();
  for (const char of lessonChars) {
    for (const other of confusablesOf(char)) if (known.has(other) && !inLesson.has(other)) wanted.add(other);
  }
  return all.filter((k) => wanted.has(k.char));
}

/**
 * Picks the next kana for a katakana lesson: with probability `rate` one that has a look-alike
 * (from `pool`, which may include the review kana), otherwise any. `pick` is the weighted picker.
 */
export function pickWithConfusableBoost<T extends { id: string }>(
  pool: readonly T[],
  pick: (pool: readonly T[]) => T,
  isConfusable: (item: T) => boolean,
  rng: () => number = Math.random,
  rate = 0.5,
): T {
  const confusable = pool.filter(isConfusable);
  if (confusable.length > 0 && confusable.length < pool.length && rng() < rate) return pick(confusable);
  return pick(pool);
}

/**
 * Multiple-choice options for `target`: its classic look-alikes first (only kana in `allowed`, so the
 * learner never sees a kana they have not met), completed with similar kana.
 */
export function confusableChoices(
  target: KanaEntry,
  allowed: ReadonlySet<string>,
  count = 4,
  all: readonly KanaEntry[] = content.kana,
  rng: () => number = Math.random,
): KanaEntry[] {
  const sameScript = confusablesOf(target.char).filter((c) => /[ぁ-ゖ]/.test(c) === /[ぁ-ゖ]/.test(target.char));
  const byChar = new Map(all.map((k) => [k.char, k]));
  const fromGroup = shuffle(sameScript, rng)
    .filter((c) => allowed.has(c))
    .map((c) => byChar.get(c))
    .filter((k): k is KanaEntry => k !== undefined && k.romaji !== target.romaji);
  const chosen: KanaEntry[] = [];
  const seen = new Set<string>([target.romaji]);
  for (const k of fromGroup) {
    if (chosen.length >= count - 1) break;
    if (!seen.has(k.romaji)) {
      seen.add(k.romaji);
      chosen.push(k);
    }
  }
  if (chosen.length < count - 1) {
    const allowedEntries = all.filter((k) => allowed.has(k.char) || k.char === target.char);
    for (const pool of [allowedEntries, all]) {
      for (const k of similarKana(target, count + 3, pool, rng)) {
        if (chosen.length >= count - 1) break;
        if (!seen.has(k.romaji) && k.char !== target.char) {
          seen.add(k.romaji);
          chosen.push(k);
        }
      }
    }
  }
  return shuffle([target, ...chosen], rng);
}
