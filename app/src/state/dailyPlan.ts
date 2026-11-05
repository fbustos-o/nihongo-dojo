import type { Lesson, Word } from '../domain/schema';
import { isReadableWith } from '../engine/kanaFilter';
import { dueCount, type ItemCollection } from '../engine/srs';
import { itemKey } from './progressSchema';

/** Smallest batch /aprender offers, even when fewer words are left in today's target. */
export const MIN_LEARN_BATCH = 5;

export type PrimaryAction = 'review' | 'learn' | 'lesson' | 'none';

export interface PlanInput {
  items: ItemCollection;
  now: number;
  /** Setting `newWordsPerDay`. */
  newWordsPerDay: number;
  /** `daily[today].newWords`. */
  newWordsDone: number;
  /** How many new, readable Core words exist (see `selectNewWords`); undefined = unknown, not capped. */
  newWordsAvailable?: number;
  nextLesson?: Lesson;
}

export interface DayPlan {
  reviewsDue: number;
  newWordsTarget: number;
  newWordsDone: number;
  /** Words still to learn today: target - done, never negative and never above what is available. */
  newWordsLeft: number;
  nextLesson?: Lesson;
  /** The one highlighted action: due reviews, else pending new words, else the next lesson. */
  primary: PrimaryAction;
}

/** Pure daily plan: due reviews, new-word quota and the next lesson, with a single primary action. */
export function planToday(input: PlanInput): DayPlan {
  const reviewsDue = dueCount(input.items, input.now);
  const newWordsTarget = Math.max(0, input.newWordsPerDay);
  const newWordsDone = Math.max(0, input.newWordsDone);
  const available = input.newWordsAvailable ?? Number.POSITIVE_INFINITY;
  const newWordsLeft = Math.max(0, Math.min(newWordsTarget - newWordsDone, available));
  const primary: PrimaryAction = reviewsDue > 0 ? 'review' : newWordsLeft > 0 ? 'learn' : input.nextLesson ? 'lesson' : 'none';
  return { reviewsDue, newWordsTarget, newWordsDone, newWordsLeft, nextLesson: input.nextLesson, primary };
}

/**
 * New words for /aprender: Core words (those with a `rank`) with no progress yet (no item or srsStage 0, and
 * never marked known), whose kana reading uses only kana the learner knows, in rank order.
 * `limit` undefined = all of them.
 */
export function selectNewWords(
  vocab: readonly Word[],
  items: Readonly<Record<string, { srsStage: number }>>,
  knownKana: ReadonlySet<string>,
  limit?: number,
): Word[] {
  const out = vocab
    .filter((w) => w.rank !== undefined)
    .filter((w) => (items[itemKey('word', w.id)]?.srsStage ?? 0) === 0)
    .filter((w) => isReadableWith(w.kana, knownKana))
    .sort((a, b) => a.rank! - b.rank!);
  return limit === undefined ? out : out.slice(0, limit);
}

/** Batch size of /aprender: what is left today, but at least `MIN_LEARN_BATCH`. */
export const learnBatchSize = (newWordsLeft: number): number => Math.max(MIN_LEARN_BATCH, newWordsLeft);
