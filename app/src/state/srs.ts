import { MAX_SRS_STAGE, type ItemState } from './progressSchema';

const HOUR = 3_600_000;
/** Hours until the next review, indexed by SRS stage. */
const INTERVAL_HOURS = [0, 4, 8, 24, 48, 168, 336, 720, 2880];

/**
 * Placeholder SRS update: +1 stage when correct, -2 when wrong.
 * TODO(E2): replace with the real SRS engine and weighted selector.
 */
export function applyAnswer(item: ItemState, correct: boolean, now: number): ItemState {
  const srsStage = correct ? Math.min(MAX_SRS_STAGE, item.srsStage + 1) : Math.max(0, item.srsStage - 2);
  return {
    ...item,
    srsStage,
    correct: item.correct + (correct ? 1 : 0),
    wrong: item.wrong + (correct ? 0 : 1),
    lastSeen: now,
    nextDue: now + (INTERVAL_HOURS[srsStage] ?? 0) * HOUR,
    weight: correct ? Math.max(1, item.weight - 1) : item.weight + 2,
  };
}
