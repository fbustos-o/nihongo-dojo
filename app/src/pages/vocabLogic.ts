import { glosses } from '../domain/glosses';
import type { Word } from '../domain/schema';
import { katakanaToHiragana } from '../engine/kanaFilter';
import { GURU_STAGE } from '../engine/srs';
import { itemKey, type Lang } from '../state/progressSchema';

export type VocabStatus = 'new' | 'apprentice' | 'guru' | 'master' | 'burned';
export const VOCAB_STATUSES: readonly VocabStatus[] = ['new', 'apprentice', 'guru', 'master', 'burned'];

/** Rank ranges of the filter (inclusive). */
export const RANK_RANGES: readonly { id: string; from: number; to: number }[] = [
  { id: '1-100', from: 1, to: 100 },
  { id: '101-300', from: 101, to: 300 },
  { id: '301-600', from: 301, to: 600 },
  { id: '601-1000', from: 601, to: 1000 },
];

/** SRS group of a stage: 0 / no item = new, 1-4 apprentice, 5-6 guru, 7-8 master+, 9 burned. */
export function statusOfStage(stage: number | undefined): VocabStatus {
  if (!stage || stage <= 0) return 'new';
  if (stage < GURU_STAGE) return 'apprentice';
  if (stage <= 6) return 'guru';
  return stage >= 9 ? 'burned' : 'master';
}

export interface VocabFilters {
  /** Only words with a Core `rank`. */
  coreOnly: boolean;
  query: string;
  /** Id of `RANK_RANGES`, or '' for any. */
  range: string;
  status: VocabStatus | '';
  source: Word['source'] | '';
}

export const defaultFilters = (): VocabFilters => ({ coreOnly: true, query: '', range: '', status: '', source: '' });

/** Lowercase, no accents, katakana as hiragana: «Cafe» matches «café», ア matches あ. */
export function normalizeSearch(text: string): string {
  return katakanaToHiragana(text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()).normalize('NFC');
}

const stageOf = (items: Readonly<Record<string, { srsStage: number }>>, w: Word): number => items[itemKey('word', w.id)]?.srsStage ?? 0;

/** True when the learner knows the word (Guru or above, including «ya la sé»). */
export const isKnownStage = (stage: number): boolean => stage >= GURU_STAGE;

function matchesQuery(word: Word, query: string, lang: Lang): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  const haystack = [word.kana, word.kanji ?? '', word.written ?? '', word.romaji, ...glosses(word, lang), ...word.es, ...(word.en ?? [])].map(normalizeSearch);
  return haystack.some((h) => h.includes(q));
}

/** Words that pass the filters, Core ones by rank first and the rest in their original order. */
export function filterVocab(
  vocab: readonly Word[],
  items: Readonly<Record<string, { srsStage: number }>>,
  filters: VocabFilters,
  lang: Lang,
): Word[] {
  const range = RANK_RANGES.find((r) => r.id === filters.range);
  const out = vocab.filter((w) => {
    if (filters.coreOnly && w.rank === undefined) return false;
    if (range && (w.rank === undefined || w.rank < range.from || w.rank > range.to)) return false;
    if (filters.source && w.source !== filters.source) return false;
    if (filters.status && statusOfStage(stageOf(items, w)) !== filters.status) return false;
    return matchesQuery(w, filters.query, lang);
  });
  const rankOf = (w: Word) => w.rank ?? Number.POSITIVE_INFINITY;
  return out
    .map((w, i) => ({ w, i }))
    .sort((a, b) => rankOf(a.w) - rankOf(b.w) || a.i - b.i)
    .map((x) => x.w);
}

/** `{ known, total }` among the Core words (those with a rank). */
export function coreKnown(vocab: readonly Word[], items: Readonly<Record<string, { srsStage: number }>>): { known: number; total: number } {
  const core = vocab.filter((w) => w.rank !== undefined);
  return { known: core.filter((w) => isKnownStage(stageOf(items, w))).length, total: core.length };
}
