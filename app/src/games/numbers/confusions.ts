import { allReadings, type Reading } from '../../engine';
import { shuffle } from '../kanaUtils';
import type { Rng } from './random';

/**
 * Typical learner mix-ups, as substring rules on the kana reading
 * (rendaku / sokuon irregulars read "regularly", yo/shi/shichi/kyuu variants, special day names).
 */
const RULES: readonly (readonly [string, string])[] = [
  // hundreds / thousands
  ['さんびゃく', 'さんひゃく'],
  ['ろっぴゃく', 'ろくひゃく'],
  ['ろっぴゃく', 'ろっひゃく'],
  ['はっぴゃく', 'はちひゃく'],
  ['はっぴゃく', 'はっひゃく'],
  ['さんぜん', 'さんせん'],
  ['はっせん', 'はちせん'],
  ['いっせん', 'いちせん'],
  ['よんひゃく', 'よひゃく'],
  ['ななひゃく', 'しちひゃく'],
  ['きゅうひゃく', 'くひゃく'],
  ['よん', 'し'],
  ['なな', 'しち'],
  ['しち', 'なな'],
  ['きゅう', 'く'],
  // clock
  ['よじ', 'よんじ'],
  ['しちじ', 'ななじ'],
  ['くじ', 'きゅうじ'],
  ['よんじ', 'よじ'],
  ['いっぷん', 'いちふん'],
  ['ろっぷん', 'ろくふん'],
  ['はっぷん', 'はちふん'],
  ['じゅっぷん', 'じゅうふん'],
  ['さんぷん', 'さんふん'],
  ['よんぷん', 'よんふん'],
  ['ごふん', 'ごぷん'],
  ['ぷん', 'ふん'],
  ['ふん', 'ぷん'],
  // counters
  ['ひとり', 'いちにん'],
  ['ふたり', 'ににん'],
  ['よにん', 'よんにん'],
  ['さんがい', 'さんかい'],
  ['ろっかい', 'ろくかい'],
  ['はっかい', 'はちかい'],
  ['いっかい', 'いちかい'],
  ['はっさい', 'はちさい'],
  ['いっさい', 'いちさい'],
  ['じゅっさい', 'じゅうさい'],
  ['ひとつ', 'いちつ'],
  ['ふたつ', 'ににつ'],
  ['みっつ', 'さんつ'],
  ['よっつ', 'よんつ'],
  ['むっつ', 'ろくつ'],
  ['ななつ', 'しちつ'],
  ['やっつ', 'はちつ'],
  ['ここのつ', 'きゅうつ'],
  // dates
  ['ついたち', 'いちにち'],
  ['ふつか', 'ににち'],
  ['みっか', 'さんにち'],
  ['よっか', 'よんにち'],
  ['いつか', 'ごにち'],
  ['むいか', 'ろくにち'],
  ['なのか', 'ななにち'],
  ['ようか', 'はちにち'],
  ['ここのか', 'きゅうにち'],
  ['とおか', 'じゅうにち'],
  ['はつか', 'にじゅうにち'],
  ['じゅうよっか', 'じゅうよんにち'],
  ['にじゅうよっか', 'にじゅうよんにち'],
  ['しがつ', 'よんがつ'],
  ['くがつ', 'きゅうがつ'],
  ['しちがつ', 'ななつがつ'],
];

/** "Regularised" wrong versions of a reading (the plausible mistakes). */
export function confusions(kana: string): string[] {
  const out = new Set<string>();
  for (const [from, to] of RULES) {
    if (kana.includes(from)) out.add(kana.replace(from, to));
  }
  out.delete(kana);
  return [...out];
}

/**
 * Up to `count` options (the primary reading + plausible wrong ones), shuffled.
 * Distractors never equal any accepted reading. Typical mix-ups come first, then `related` readings.
 */
export function buildChoices(answer: Reading, related: readonly string[], rng: Rng, count = 4): string[] {
  const accepted = new Set(allReadings(answer));
  const bad = (s: string) => accepted.has(s);
  const mistakes = shuffle(confusions(answer.kana), rng).filter((s) => !bad(s));
  const others = shuffle([...new Set(related)], rng).filter((s) => !bad(s) && !mistakes.includes(s));
  const picked = [...mistakes.slice(0, 2), ...others, ...mistakes.slice(2)].slice(0, count - 1);
  return shuffle([answer.kana, ...picked], rng);
}
