import { content } from '../domain/contentLoader';
import type { Word } from '../domain/schema';
import { shuffle } from './kanaUtils';

/** Spanish meaning shown for a word. */
export const meaningOf = (word: Word): string => word.es[0] ?? word.romaji;

/** Four Spanish meanings: the target's plus distractors with different text, shuffled. */
export function meaningChoices(
  target: Word,
  count = 4,
  all: readonly Word[] = content.vocab,
  rng: () => number = Math.random,
): { text: string; correct: boolean }[] {
  const taken = new Set(target.es);
  const distractors: string[] = [];
  for (const word of shuffle(all, rng)) {
    const text = meaningOf(word);
    if (word.id !== target.id && !taken.has(text) && !distractors.includes(text)) distractors.push(text);
    if (distractors.length === count - 1) break;
  }
  return shuffle([{ text: meaningOf(target), correct: true }, ...distractors.map((text) => ({ text, correct: false }))], rng);
}

/** The target word plus distractors with a different reading (taken from `pool`), shuffled. */
export function wordChoices(target: Word, pool: readonly Word[], count = 4, rng: () => number = Math.random): Word[] {
  const others = shuffle(
    pool.filter((w) => w.id !== target.id && w.kana !== target.kana),
    rng,
  );
  const distractors: Word[] = [];
  for (const w of others) {
    if (!distractors.some((d) => d.kana === w.kana)) distractors.push(w);
    if (distractors.length === count - 1) break;
  }
  return shuffle([target, ...distractors], rng);
}
