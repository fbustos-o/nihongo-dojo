import { content } from '../domain/contentLoader';
import type { KanaEntry } from '../domain/schema';
import { toKatakana } from 'wanakana';
import { levenshtein, splitKanaUnits } from '../engine';

/** Romaji accepted for a kana: `romaji` + `alt`, plus the usual IME spellings of the small っ. */
export function acceptedRomaji(entry: KanaEntry): string[] {
  const list = [entry.romaji, ...(entry.alt ?? [])];
  if (entry.romaji === 'xtsu') list.push('ltsu', 'xtu', 'ltu');
  return [...new Set(list.map((r) => r.toLowerCase()))];
}

export type RomajiVerdict = 'correct' | 'near' | 'wrong';

const normalize = (text: string): string => text.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, '').replace(/ー/g, '-');

/**
 * Judges a typed romaji for a kana. "near" = one typo away from an accepted spelling
 * (and not itself the romaji of another kana, which is a plain mistake).
 */
export function judgeRomaji(input: string, entry: KanaEntry, all: readonly KanaEntry[] = content.kana): RomajiVerdict {
  const typed = normalize(input);
  if (typed === '') return 'wrong';
  const accepted = acceptedRomaji(entry);
  if (accepted.includes(typed)) return 'correct';
  const isOtherKana = all.some((k) => k !== entry && acceptedRomaji(k).includes(typed));
  if (!isOtherKana && typed.length >= 2 && accepted.some((a) => a.length >= 2 && levenshtein(typed, a) <= 1)) return 'near';
  return 'wrong';
}

/** Random in-place-free shuffle. */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Similar-looking distractors: kana of the same script and group, nearest in table order
 * (same row first, then neighbouring rows). Never repeats the target or a romaji already shown.
 */
export function similarKana(
  target: KanaEntry,
  count = 3,
  all: readonly KanaEntry[] = content.kana,
  rng: () => number = Math.random,
): KanaEntry[] {
  const sameScript = all.filter((k) => k.script === target.script);
  const index = sameScript.findIndex((k) => k.char === target.char);
  const ranked = sameScript
    .map((k, i) => ({ k, d: Math.abs(i - index) + (k.row === target.row ? -0.5 : 0) + (k.group === target.group ? 0 : 20) }))
    .filter(({ k }) => k.char !== target.char && k.romaji !== target.romaji)
    .sort((a, b) => a.d - b.d)
    .map(({ k }) => k);
  const seen = new Set<string>([target.romaji]);
  const near: KanaEntry[] = [];
  for (const k of ranked.slice(0, count + 4)) {
    if (!seen.has(k.romaji)) {
      seen.add(k.romaji);
      near.push(k);
    }
  }
  return shuffle(near, rng).slice(0, count);
}

/** The target and its distractors, shuffled. */
export function kanaChoices(target: KanaEntry, count = 4, all: readonly KanaEntry[] = content.kana, rng = Math.random): KanaEntry[] {
  return shuffle([target, ...similarKana(target, count - 1, all, rng)], rng);
}

export const kanaByChar = (chars: Iterable<string>, all: readonly KanaEntry[] = content.kana): KanaEntry[] => {
  const wanted = new Set(chars);
  return all.filter((k) => wanted.has(k.char));
};

/** Text shown for the romaji of a kana in multiple choice (ー and ッ have no plain romaji). */
export function romajiLabel(entry: KanaEntry): string {
  if (entry.char === 'ー') return '- (vocal larga)';
  if (entry.char === 'ッ' || entry.char === 'っ') return 'xtsu (pausa)';
  return entry.romaji;
}

/** Spanish hint for the kana that are not read as a plain syllable. */
export function kanaHint(entry: KanaEntry): string | null {
  switch (entry.char) {
    case 'ー':
      return 'Marca de vocal larga: escribe «-» (guion).';
    case 'ッ':
    case 'っ':
      return 'Pausa que duplica la consonante siguiente: escribe «xtsu» (o «ltsu»).';
    case 'ヴ':
      return 'Suena «vu» (v inglesa).';
    default:
      return null;
  }
}

export interface TypingHint {
  char: string;
  typing: string;
}

/**
 * Katakana in `text` whose usual romaji does not produce it in the katakana IME (ティ needs `thi`,
 * not `ti`, which gives チ; ウォ needs `who`). Deduplicated, in order of appearance.
 */
export function typingHints(text: string, all: readonly KanaEntry[] = content.kana): TypingHint[] {
  const out = new Map<string, string>();
  for (const unit of splitKanaUnits(text).units) {
    if (out.has(unit)) continue;
    const entry = all.find((k) => k.char === unit && k.script === 'katakana');
    if (!entry || toKatakana(entry.romaji) === unit) continue;
    const typing = (entry.alt ?? []).find((r) => toKatakana(r) === unit);
    if (typing) out.set(unit, typing);
  }
  return [...out].map(([char, typing]) => ({ char, typing }));
}
