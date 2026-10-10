import type { SentencePattern } from '../../domain/schema';
import { shuffle } from '../kanaUtils';
import { examplesOf, tokenize } from '../syntax/syntaxLogic';

export interface ReadingSentence {
  /** `<patternId>:<exampleIndex>`: progress item id. */
  id: string;
  patternId: string;
  ja: string;
  es: string;
  romaji: string;
  tokens: string[];
}

export interface ReadingOption {
  key: string;
  text: string;
  correct: boolean;
}

export interface ReadingQuestion {
  /** Progress item id of the sentence asked about. */
  itemId: string;
  prompt: string;
  options: ReadingOption[];
}

export interface ReadingText {
  sentences: ReadingSentence[];
  questions: ReadingQuestion[];
}

export const MIN_SENTENCES = 4;
export const MAX_SENTENCES = 6;

/** Every example of the patterns as a sentence. */
export function sentencesOf(patterns: readonly SentencePattern[]): ReadingSentence[] {
  return patterns.flatMap((pattern) =>
    examplesOf(pattern).flatMap((example, index) =>
      example.ja && example.es ? [{ id: `${pattern.id}:${index}`, patternId: pattern.id, ja: example.ja, es: example.es, romaji: example.romaji, tokens: tokenize(example.ja) }] : [],
    ),
  );
}

/**
 * A short text: sentences of one pattern first (a coherent theme), then those of the next patterns
 * until there are up to six. Spanish duplicates are dropped. Null when there are fewer than four.
 */
export function pickSentences(patterns: readonly SentencePattern[], rng: () => number = Math.random): ReadingSentence[] | null {
  const groups = patterns.map((p) => sentencesOf([p])).filter((g) => g.length > 0);
  if (groups.length === 0) return null;
  const start = Math.floor(rng() * groups.length);
  const ordered = [...groups.slice(start), ...groups.slice(0, start)];
  const seen = new Set<string>();
  const out: ReadingSentence[] = [];
  for (const group of ordered) {
    for (const sentence of shuffle(group, rng)) {
      if (out.length >= MAX_SENTENCES) break;
      if (seen.has(sentence.es)) continue;
      seen.add(sentence.es);
      out.push(sentence);
    }
  }
  return out.length >= MIN_SENTENCES ? out : null;
}

/** Three multiple-choice questions about a text. Distractors come from other sentences. */
export function buildQuestions(sentences: readonly ReadingSentence[], pool: readonly ReadingSentence[], rng: () => number = Math.random): ReadingQuestion[] {
  const order = shuffle(
    sentences.map((_, i) => i),
    rng,
  );
  const meaning = (index: number): ReadingQuestion => {
    const target = sentences[index]!;
    const others = shuffle(
      [...sentences, ...pool].filter((s) => s.es !== target.es),
      rng,
    );
    const distractors: string[] = [];
    for (const s of others) if (!distractors.includes(s.es)) distractors.push(s.es);
    return {
      itemId: target.id,
      prompt: `¿Qué significa la frase ${index + 1}?`,
      options: shuffle(
        [{ key: 'ok', text: target.es, correct: true }, ...distractors.slice(0, 3).map((text, i) => ({ key: `d${i}`, text, correct: false }))],
        rng,
      ),
    };
  };
  const which = (index: number): ReadingQuestion => {
    const target = sentences[index]!;
    const wrong = sentences.map((_, i) => i).filter((i) => i !== index);
    return {
      itemId: target.id,
      prompt: `¿Qué frase dice «${target.es}»?`,
      options: shuffle(
        [{ key: 'ok', text: `Frase ${index + 1}`, correct: true }, ...shuffle(wrong, rng).slice(0, 3).map((i) => ({ key: `d${i}`, text: `Frase ${i + 1}`, correct: false }))],
        rng,
      ),
    };
  };
  return [meaning(order[0]!), meaning(order[1]!), which(order[2]!)];
}

/** A whole text with its questions, or null when the patterns have too few examples. */
export function makeReadingText(patterns: readonly SentencePattern[], pool: readonly ReadingSentence[], rng: () => number = Math.random): ReadingText | null {
  const sentences = pickSentences(patterns, rng);
  return sentences ? { sentences, questions: buildQuestions(sentences, pool, rng) } : null;
}
