import type { Kanji, SentencePattern, Word } from '../../domain/schema';
import { shuffle } from '../kanaUtils';
import { examplesOf, isParticle, tokenize } from '../syntax/syntaxLogic';

const IS_KANJI = /[一-鿿]/u;

/** The kanji (not the repetition mark 々) of a written word. */
export const kanjiOf = (text: string): string[] => [...text].filter((ch) => IS_KANJI.test(ch));

/** Spanish meaning shown for a kanji: its first two glosses. */
export const meaningText = (k: Kanji): string => k.es.slice(0, 2).join('; ');

/** Readings Genki teaches for the kanji, split in on-yomi and kun-yomi (falls back to the first of each). */
export function taughtReadings(k: Kanji): { on: string[]; kun: string[] } {
  const teach = new Set(k.teach ?? []);
  const on = k.on.filter((r) => teach.has(r));
  const kun = k.kun.filter((r) => teach.has(r));
  return { on: on.length > 0 || kun.length > 0 ? on : k.on.slice(0, 1), kun: on.length > 0 || kun.length > 0 ? kun : k.kun.slice(0, 1) };
}

/** "on: しょく · kun: た(べる)" for the prompt of the "pick the kanji" round. */
export function readingLabel(k: Kanji): string {
  const { on, kun } = taughtReadings(k);
  return [on.length > 0 ? `on: ${on.slice(0, 2).join(', ')}` : '', kun.length > 0 ? `kun: ${kun.slice(0, 2).join(', ')}` : ''].filter(Boolean).join(' · ');
}

/** Four Spanish meanings: the target's plus distractors with other meanings, shuffled. */
export function meaningOptions(target: Kanji, pool: readonly Kanji[], count = 4, rng: () => number = Math.random): { text: string; correct: boolean }[] {
  const taken = new Set(target.es);
  const texts: string[] = [];
  for (const k of shuffle(pool, rng)) {
    const text = meaningText(k);
    if (k.char !== target.char && !k.es.some((m) => taken.has(m)) && !texts.includes(text)) texts.push(text);
    if (texts.length === count - 1) break;
  }
  return shuffle([{ text: meaningText(target), correct: true }, ...texts.map((text) => ({ text, correct: false }))], rng);
}

/**
 * The target kanji plus look-alikes as distractors (Kanjium look-alikes and same-radical kanji first,
 * then kanji of the same Genki lesson, then any), all taken from kanji the learner knows. Shuffled.
 */
export function kanjiOptions(target: Kanji, pool: readonly Kanji[], count = 4, rng: () => number = Math.random): Kanji[] {
  const others = pool.filter((k) => k.char !== target.char);
  const similar = new Set(target.similar ?? []);
  const tiers = [
    others.filter((k) => similar.has(k.char)),
    others.filter((k) => !similar.has(k.char) && k.genkiLesson === target.genkiLesson),
    others.filter((k) => !similar.has(k.char) && k.genkiLesson !== target.genkiLesson),
  ];
  const picked: Kanji[] = [];
  for (const tier of tiers) {
    for (const k of shuffle(tier, rng)) {
      if (picked.length < count - 1) picked.push(k);
    }
  }
  return shuffle([target, ...picked], rng);
}

/**
 * Known words written with kanji that can be asked: every kanji is in `allowed` and, when `practice` is not
 * empty, at least one is being practised.
 */
export function kanjiWordsFor(words: readonly Word[], allowed: ReadonlySet<string>, practice: ReadonlySet<string> = new Set()): Word[] {
  return words.filter((w) => {
    if (!w.kanji) return false;
    const chars = kanjiOf(w.kanji);
    return chars.length > 0 && chars.every((c) => allowed.has(c)) && (practice.size === 0 || chars.some((c) => practice.has(c)));
  });
}

export interface TransformToken {
  kana: string;
  /** Present when this token is shown in kanji (with furigana by JaText). */
  word?: Word;
}

/** A stage-2 sentence (kana only in patterns.json) whose words now appear in kanji. */
export interface TransformSentence {
  /** `<patternId>:<exampleIndex>`. */
  id: string;
  es: string;
  romaji: string;
  tokens: TransformToken[];
  /** The word the round is about (progress item `<word.id>:kanji`). */
  target: Word;
}

/**
 * Known sentences with kanji: every token (not a particle, at least two kana) that is the reading of an
 * allowed kanji word is written with its kanji. The sentence counts for the word it transforms that the learner
 * practises (any of them when `practice` is empty).
 */
export function transformSentences(
  patterns: readonly SentencePattern[],
  vocab: readonly Word[],
  allowed: ReadonlySet<string>,
  practice: ReadonlySet<string> = new Set(),
): TransformSentence[] {
  const byKana = new Map<string, Word[]>();
  for (const w of kanjiWordsFor(vocab, allowed)) byKana.set(w.kana, [...(byKana.get(w.kana) ?? []), w]);
  const practised = (w: Word) => practice.size === 0 || kanjiOf(w.kanji ?? '').some((c) => practice.has(c));
  const out: TransformSentence[] = [];
  for (const pattern of patterns) {
    examplesOf(pattern).forEach((example, index) => {
      if (!example.ja || !example.es) return;
      const tokens: TransformToken[] = tokenize(example.ja).map((kana) => {
        if (isParticle(kana) || [...kana].length < 2) return { kana };
        const candidates = byKana.get(kana) ?? [];
        const word = candidates.find(practised) ?? candidates[0];
        return word ? { kana, word } : { kana };
      });
      const target = tokens.find((t) => t.word && practised(t.word))?.word;
      if (target) out.push({ id: `${pattern.id}:${index}`, es: example.es, romaji: example.romaji, tokens, target });
    });
  }
  return out;
}

/** Four Spanish sentence meanings: the sentence's plus others, shuffled. */
export function sentenceOptions(target: TransformSentence, pool: readonly { es: string }[], count = 4, rng: () => number = Math.random): { text: string; correct: boolean }[] {
  const texts: string[] = [];
  for (const s of shuffle(pool, rng)) {
    if (s.es !== target.es && !texts.includes(s.es)) texts.push(s.es);
    if (texts.length === count - 1) break;
  }
  return shuffle([{ text: target.es, correct: true }, ...texts.map((text) => ({ text, correct: false }))], rng);
}

export type RoundType = 'meaning' | 'pick' | 'reading' | 'transform';
/** Round types in play order (kanji items go first so they advance in SRS). */
export const ROUND_ORDER: readonly RoundType[] = ['meaning', 'pick', 'reading', 'transform'];

/**
 * Round type for round `round`: cycles meaning -> pick -> reading -> transform, skipping the ones that
 * cannot be built with the available material. Null when nothing can be asked.
 */
export function roundTypeFor(round: number, available: Readonly<Record<RoundType, boolean>>): RoundType | null {
  for (let i = 0; i < ROUND_ORDER.length; i++) {
    const type = ROUND_ORDER[(round + i) % ROUND_ORDER.length]!;
    if (available[type]) return type;
  }
  return null;
}
