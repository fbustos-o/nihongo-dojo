import { MAX_SRS_STAGE, type ItemState } from '../state/progressSchema';

/**
 * WaniKani-style spaced repetition.
 *
 * Stages: 0 Nuevo, 1-4 Aprendiz, 5-6 Guru, 7 Maestro, 8 Iluminado, 9 Quemado (burned).
 * The interval after reaching a stage: 4h, 8h, 1d, 2d, 1w, 2w, 1mo (30d), 4mo (120d), then never.
 * All functions are pure: the current time is always passed in (epoch ms).
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const BURNED_STAGE = MAX_SRS_STAGE;
export const GURU_STAGE = 5;

/** Milliseconds until the next review for an item that has just reached each stage. */
export const STAGE_INTERVAL_MS: readonly (number | null)[] = [
  0, // stage 0: due again immediately (only reachable after a wrong first answer)
  4 * HOUR,
  8 * HOUR,
  DAY,
  2 * DAY,
  7 * DAY,
  14 * DAY,
  30 * DAY,
  120 * DAY,
  null, // burned
];

/** `nextDue` of burned items: far in the future but JSON-safe. */
export const NEVER_DUE = Number.MAX_SAFE_INTEGER;

const STAGE_NAMES_ES = [
  'Nuevo',
  'Aprendiz 1',
  'Aprendiz 2',
  'Aprendiz 3',
  'Aprendiz 4',
  'Guru 1',
  'Guru 2',
  'Maestro',
  'Iluminado',
  'Quemado',
] as const;

/** Spanish name of an SRS stage ("Aprendiz 1", "Guru 2", "Quemado"…). Out-of-range stages are clamped. */
export function stageName(stage: number): string {
  const i = Math.max(0, Math.min(MAX_SRS_STAGE, Math.trunc(stage)));
  return STAGE_NAMES_ES[i]!;
}

/** Coarse Spanish group name: Nuevo, Aprendiz, Guru, Maestro, Iluminado, Quemado. */
export function stageGroupName(stage: number): string {
  return stageName(stage).replace(/ \d$/, '');
}

/** True from Guru on: the learner "knows" the item (kanji lose furigana here). */
export const isGuruOrAbove = (stage: number): boolean => stage >= GURU_STAGE;
export const isBurned = (stage: number): boolean => stage >= BURNED_STAGE;

/**
 * Stage after an answer.
 * - Correct: +1 (capped at Quemado).
 * - Wrong: drops by ceil(errors / 2) x (stage >= Guru ? 2 : 1), never below 1.
 *   A brand-new item (stage 0) that is answered wrong stays at 0 and is due again at once.
 * @param errors number of wrong attempts at this item in the current review (default 1)
 */
export function nextStage(stage: number, correct: boolean, errors = 1): number {
  if (correct) return Math.min(MAX_SRS_STAGE, stage + 1);
  if (stage <= 0) return 0;
  const penalty = Math.ceil(Math.max(1, errors) / 2) * (stage >= GURU_STAGE ? 2 : 1);
  return Math.max(1, stage - penalty);
}

/** Epoch ms at which an item that has just reached `stage` is next due. */
export function dueTimeFor(stage: number, now: number): number {
  const interval = STAGE_INTERVAL_MS[Math.max(0, Math.min(MAX_SRS_STAGE, stage))];
  return interval === null || interval === undefined ? NEVER_DUE : now + interval;
}

/** Applies one answer to an item. Pure: `now` is injected. */
export function applyAnswer(item: ItemState, correct: boolean, now: number, errors = 1): ItemState {
  const srsStage = nextStage(item.srsStage, correct, errors);
  return {
    ...item,
    srsStage,
    correct: item.correct + (correct ? 1 : 0),
    wrong: item.wrong + (correct ? 0 : 1),
    lastSeen: now,
    nextDue: dueTimeFor(srsStage, now),
    weight: correct ? Math.max(1, item.weight - 1) : item.weight + 2,
  };
}

export type ItemCollection = Readonly<Record<string, ItemState>> | readonly ItemState[];

const itemList = (items: ItemCollection): ItemState[] =>
  Array.isArray(items) ? [...(items as readonly ItemState[])] : Object.values(items as Record<string, ItemState>);

/** An item is due when it has been seen, is not burned and its `nextDue` has passed. */
export function isDue(item: ItemState, now: number): boolean {
  return item.lastSeen > 0 && !isBurned(item.srsStage) && item.nextDue <= now;
}

/** Items due for review at `now`, most overdue first. Accepts `progress.items` or an array. */
export function dueItems(items: ItemCollection, now: number): ItemState[] {
  return itemList(items)
    .filter((item) => isDue(item, now))
    .sort((a, b) => a.nextDue - b.nextDue || a.itemId.localeCompare(b.itemId));
}

export interface ReviewQueueOptions {
  /** Maximum number of reviews in the session. */
  limit?: number;
  /** When given, the queue is shuffled (Fisher-Yates) with this RNG after the limit is applied. */
  rng?: () => number;
}

/**
 * Builds the review session: the `limit` most overdue due items, optionally shuffled.
 * Without `rng` the order is deterministic (most overdue first).
 */
export function reviewQueue(items: ItemCollection, now: number, options: ReviewQueueOptions = {}): ItemState[] {
  const due = dueItems(items, now);
  const queue = options.limit === undefined ? due : due.slice(0, Math.max(0, options.limit));
  if (options.rng) {
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(options.rng() * (i + 1));
      [queue[i], queue[j]] = [queue[j]!, queue[i]!];
    }
  }
  return queue;
}

/** Number of due items (for badges). */
export const dueCount = (items: ItemCollection, now: number): number => dueItems(items, now).length;

/** Counts items per stage group, e.g. for a dashboard. */
export function stageCounts(items: ItemCollection): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of itemList(items)) {
    const g = stageGroupName(item.srsStage);
    counts[g] = (counts[g] ?? 0) + 1;
  }
  return counts;
}
