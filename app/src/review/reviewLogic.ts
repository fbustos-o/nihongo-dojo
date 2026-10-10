import type { GameId, Kanji, KanaEntry, SentencePattern, Word } from '../domain/schema';
import { reviewQueue, stageGroupName, type ItemCollection } from '../engine/srs';
import type { ItemState } from '../state/progressSchema';

/**
 * Review routing. Progress items are `{ kind, itemId }`; games write these id conventions
 * (see src/games/README.md, "Ids de ítems"):
 *
 *   kind kana     `あ`                         -> kana-recognize
 *   kind kanji    `食`                         -> kanji
 *   kind word     `<id>:kanji`                 -> kanji        (word asked in the kanji game)
 *   kind word     `verb|iadj|naadj|noun:<id>:<form>` -> conjugation
 *   kind word     `number:416`, `counter:nin:3`      -> numbers
 *   kind word     `time:7:30`                  -> clock
 *   kind word     `date:3:14`, `date:wd:...`   -> calendar
 *   kind word     `<id>`                       -> read-words   (plain vocabulary)
 *   kind pattern  `particle:<pattern>:<n>`     -> particles
 *   kind pattern  `<pattern>:<n>`              -> syntax
 *   kind dialogue `dialogue:<id>:<line>`       -> dialogues
 *
 * The numbers / time / date / counter ids use kind `word` (decided in E4); they are told apart by prefix here.
 */
export type ReviewCategory = 'kana' | 'kanji' | 'word' | 'conjugation' | 'number' | 'clock' | 'calendar' | 'syntax' | 'particle' | 'dialogue';

/** Dashboard groups: kana, words (vocabulary, conjugation, numbers, time, dates), patterns (sentences, particles, dialogues), kanji. */
export type ReviewGroupId = 'kana' | 'words' | 'patterns' | 'kanji';

export const REVIEW_GROUP_LABELS: Record<ReviewGroupId, string> = { kana: 'Kana', words: 'Palabras', patterns: 'Patrones', kanji: 'Kanji' };
export const REVIEW_GROUP_IDS = Object.keys(REVIEW_GROUP_LABELS) as ReviewGroupId[];

const CONJUGATION_PREFIXES = ['verb:', 'iadj:', 'naadj:', 'noun:'];

export function classifyItem(item: Pick<ItemState, 'kind' | 'itemId'>): ReviewCategory {
  const id = item.itemId;
  switch (item.kind) {
    case 'kana':
      return 'kana';
    case 'kanji':
      return 'kanji';
    case 'pattern':
      return id.startsWith('particle:') ? 'particle' : 'syntax';
    case 'dialogue':
      return 'dialogue';
    case 'word':
      if (id.endsWith(':kanji')) return 'kanji';
      if (CONJUGATION_PREFIXES.some((p) => id.startsWith(p))) return 'conjugation';
      if (id.startsWith('number:') || id.startsWith('counter:')) return 'number';
      if (id.startsWith('time:')) return 'clock';
      if (id.startsWith('date:')) return 'calendar';
      return 'word';
  }
}

const GROUP_OF: Record<ReviewCategory, ReviewGroupId> = {
  kana: 'kana',
  kanji: 'kanji',
  word: 'words',
  conjugation: 'words',
  number: 'words',
  clock: 'words',
  calendar: 'words',
  syntax: 'patterns',
  particle: 'patterns',
  dialogue: 'patterns',
};

export const groupOfItem = (item: Pick<ItemState, 'kind' | 'itemId'>): ReviewGroupId => GROUP_OF[classifyItem(item)];

/** Game that reviews each category. */
export const GAME_OF: Record<ReviewCategory, GameId> = {
  kana: 'kana-recognize',
  kanji: 'kanji',
  word: 'read-words',
  conjugation: 'conjugation',
  number: 'numbers',
  clock: 'clock',
  calendar: 'calendar',
  syntax: 'syntax',
  particle: 'particles',
  dialogue: 'dialogues',
};

const asList = (items: ItemCollection): ItemState[] => (Array.isArray(items) ? [...(items as readonly ItemState[])] : Object.values(items as Record<string, ItemState>));

export interface DueCounts extends Record<ReviewGroupId, number> {
  total: number;
}

/** Due items per dashboard group. */
export function dueCountsByGroup(items: ItemCollection, now: number): DueCounts {
  const counts: DueCounts = { kana: 0, words: 0, patterns: 0, kanji: 0, total: 0 };
  for (const item of reviewQueue(asList(items), now)) {
    counts[groupOfItem(item)] += 1;
    counts.total += 1;
  }
  return counts;
}

export const SRS_GROUPS = ['Aprendiz', 'Guru', 'Maestro', 'Iluminado', 'Quemado'] as const;
export type SrsGroup = (typeof SRS_GROUPS)[number];

/** Items per SRS group. Stage 0 (answered wrong while new) counts as Aprendiz. */
export function srsDistribution(items: ItemCollection): Record<SrsGroup, number> {
  const out: Record<SrsGroup, number> = { Aprendiz: 0, Guru: 0, Maestro: 0, Iluminado: 0, Quemado: 0 };
  for (const item of asList(items)) {
    const name = stageGroupName(item.srsStage);
    out[name === 'Nuevo' ? 'Aprendiz' : (name as SrsGroup)] += 1;
  }
  return out;
}

export const MAX_REVIEW = 50;

/** Items of one target game inside a review session. */
export interface ReviewBatch {
  game: GameId;
  /** Progress `itemId`s (as stored in `ItemState.itemId`). */
  itemIds: string[];
}

export interface ReviewPlan {
  batches: ReviewBatch[];
  total: number;
}

/**
 * The unified review queue: the most overdue due items (at most `limit`, optionally of one dashboard group),
 * grouped by the game that reviews them. Batches come in the order of their most overdue item.
 */
export function planReview(items: ItemCollection, now: number, options: { limit?: number; group?: ReviewGroupId } = {}): ReviewPlan {
  const { limit = MAX_REVIEW, group } = options;
  const pool = group ? asList(items).filter((i) => groupOfItem(i) === group) : items;
  const queue = reviewQueue(pool, now, { limit });
  const byGame = new Map<GameId, string[]>();
  for (const item of queue) {
    const game = GAME_OF[classifyItem(item)];
    byGame.set(game, [...(byGame.get(game) ?? []), item.itemId]);
  }
  return { batches: [...byGame].map(([game, itemIds]) => ({ game, itemIds })), total: queue.length };
}

/** Everything a game needs to run one batch (a subset of `GameProps`). */
export interface BatchProps {
  kana: KanaEntry[];
  kanji?: Kanji[];
  words: Word[];
  patterns?: SentencePattern[];
  dialogueIds?: string[];
  onlyItems?: string[];
  rounds: number;
}

export interface ReviewData {
  kana: readonly KanaEntry[];
  vocab: readonly Word[];
  kanji: readonly Kanji[];
  patterns: readonly SentencePattern[];
}

const KANJI_WORD_SUFFIX = ':kanji';

/** `<pattern>:<n>` / `particle:<pattern>:<n>` -> pattern id. */
export function patternIdOf(itemId: string): string {
  const base = itemId.startsWith('particle:') ? itemId.slice('particle:'.length) : itemId;
  return base.slice(0, base.lastIndexOf(':'));
}

/** `dialogue:<id>:<line>` -> dialogue id. */
export function dialogueIdOf(itemId: string): string {
  return itemId.slice('dialogue:'.length, itemId.lastIndexOf(':'));
}

/**
 * Turns a batch into game props. Items whose content no longer exists are dropped; the result is null when
 * nothing is left. `rounds` is the number of items that were found.
 */
export function batchProps(batch: ReviewBatch, data: ReviewData): BatchProps | null {
  const ids = batch.itemIds;
  switch (batch.game) {
    case 'kana-recognize': {
      const kana = ids.flatMap((id) => data.kana.find((k) => k.char === id) ?? []);
      return kana.length > 0 ? { kana, words: [], rounds: kana.length } : null;
    }
    case 'read-words': {
      const words = ids.flatMap((id) => data.vocab.find((w) => w.id === id) ?? []);
      return words.length > 0 ? { kana: [], words, rounds: words.length } : null;
    }
    case 'kanji': {
      const kanji = ids.filter((id) => !id.endsWith(KANJI_WORD_SUFFIX)).flatMap((id) => data.kanji.find((k) => k.char === id) ?? []);
      const words = ids
        .filter((id) => id.endsWith(KANJI_WORD_SUFFIX))
        .flatMap((id) => data.vocab.find((w) => w.id === id.slice(0, -KANJI_WORD_SUFFIX.length)) ?? []);
      return kanji.length + words.length > 0 ? { kana: [], kanji, words, rounds: kanji.length + words.length } : null;
    }
    case 'syntax':
    case 'particles': {
      const wanted = new Set(ids.map(patternIdOf));
      const patterns = data.patterns.filter((p) => wanted.has(p.id));
      return patterns.length > 0 ? { kana: [], words: [], patterns, onlyItems: ids, rounds: ids.length } : null;
    }
    case 'conjugation':
      return { kana: [], words: [], onlyItems: ids, rounds: ids.length };
    case 'dialogues': {
      const dialogueIds = [...new Set(ids.map(dialogueIdOf))];
      return { kana: [], words: [], dialogueIds, rounds: ids.length };
    }
    default:
      // numbers / clock / calendar: questions are generated at random (weighted by SRS), one round per due item
      return { kana: [], words: [], rounds: ids.length };
  }
}

/** Short Spanish description of a batch for the session header. */
export const BATCH_UNIT: Partial<Record<GameId, string>> = {
  'kana-recognize': 'kana',
  'read-words': 'palabras',
  kanji: 'kanji y palabras con kanji',
  conjugation: 'conjugaciones',
  syntax: 'frases',
  particles: 'partículas',
  numbers: 'números y contadores',
  clock: 'horas',
  calendar: 'fechas',
  dialogues: 'frases de diálogos',
};
