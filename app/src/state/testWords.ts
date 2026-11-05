import type { Word } from '../domain/schema';

/** Test helper: a synthetic vocabulary word; with a `rank` it looks like a Core 1000 word. */
export const word = (id: string, kana: string, rank?: number, extra: Partial<Word> = {}): Word => ({
  id,
  kana,
  romaji: id,
  es: [`es-${id}`],
  pos: 'noun',
  lesson: rank ? 'C1' : 'L1',
  tags: [],
  source: rank ? 'core1000' : 'genki',
  ...(rank ? { rank } : {}),
  ...extra,
});
