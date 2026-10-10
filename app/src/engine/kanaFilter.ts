import type { Lesson } from '../domain/schema';

/**
 * "Only known kana" filter.
 *
 * `known` holds the kana the learner has unlocked, exactly as stored in the progress
 * (`progress.knownKana`): single characters (あ, が, っ, ー) and/or yoon digraphs (きゃ).
 *
 * Reading rules:
 * - Hiragana and katakana are different scripts: ア is not covered by あ (unless
 *   `katakanaAsHiragana` is set, which is how the UI shows still-locked katakana).
 * - Dakuten / handakuten kana (が, ぱ) are their own characters and must be in the set.
 * - Yoon (き + small ゃ/ゅ/ょ) and extended digraphs (ふ + small ぁ…): the unit is readable
 *   if the set contains the whole digraph (きゃ), OR both the base kana (き) and the small
 *   kana (ゃ). Either way of unlocking works.
 * - Sokuon っ/ッ and the long-vowel mark ー count as kana that must be known.
 * - Whitespace, punctuation, symbols and digits are ignored.
 * - Anything else (kanji, latin letters) is not readable.
 */

const SMALL_KANA = new Set('ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ');
const IGNORED = /^[\p{White_Space}\p{P}\p{S}\p{N}]$/u;
const KANA = /^[ぁ-ゖァ-ヺーゝゞヽヾ]$/;

export interface ReadableOptions {
  /** Treat katakana as its hiragana equivalent (ア needs あ). Default false. */
  katakanaAsHiragana?: boolean;
}

/** Converts katakana to hiragana, leaving ー and everything else untouched. */
export function katakanaToHiragana(text: string): string {
  return Array.from(text, (ch) => {
    const code = ch.codePointAt(0)!;
    return code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : ch;
  }).join('');
}

/** Splits text into kana units (digraphs kept together) and reports the other characters. */
export function splitKanaUnits(text: string): { units: string[]; unreadable: string[] } {
  const units: string[] = [];
  const unreadable: string[] = [];
  const chars = Array.from(text.normalize('NFC'));
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    if (IGNORED.test(ch)) continue;
    if (!KANA.test(ch)) {
      unreadable.push(ch);
      continue;
    }
    const next = chars[i + 1];
    if (next && SMALL_KANA.has(next) && !SMALL_KANA.has(ch)) {
      units.push(ch + next);
      i++;
    } else {
      units.push(ch);
    }
  }
  return { units, unreadable };
}

function unitReadable(unit: string, known: ReadonlySet<string>): boolean {
  if (known.has(unit)) return true;
  const chars = Array.from(unit);
  return chars.length > 1 && chars.every((c) => known.has(c));
}

/** The kana of `text` the learner cannot read yet (deduplicated, in order). Non-kana characters are included. */
export function missingKana(text: string, known: ReadonlySet<string>, options: ReadableOptions = {}): string[] {
  const source = options.katakanaAsHiragana ? katakanaToHiragana(text) : text;
  const { units, unreadable } = splitKanaUnits(source);
  const missing = units.filter((u) => !unitReadable(u, known));
  return [...new Set([...missing, ...unreadable])];
}

/** True when every kana in `text` is unlocked and the text has no kanji or other letters. */
export function isReadableWith(text: string, known: ReadonlySet<string>, options: ReadableOptions = {}): boolean {
  return missingKana(text, known, options).length === 0;
}

/** Words (anything with a `kana` field) whose kana reading uses only known kana. */
export function filterReadable<T extends { kana: string }>(
  words: readonly T[],
  known: ReadonlySet<string>,
  options: ReadableOptions = {},
): T[] {
  return words.filter((w) => isReadableWith(w.kana, known, options));
}

/** Union of the `kana` introduced by the completed lessons of the curriculum. */
export function unlockedKanaForLessons(
  curriculum: readonly Pick<Lesson, 'id' | 'kana'>[],
  completedIds: Iterable<string>,
): Set<string> {
  const completed = new Set(completedIds);
  const unlocked = new Set<string>();
  for (const lesson of curriculum) {
    if (!completed.has(lesson.id)) continue;
    for (const kana of lesson.kana ?? []) unlocked.add(kana);
  }
  return unlocked;
}
