import type { ItemState } from '../state/progressSchema';
import { MAX_SRS_STAGE } from '../state/progressSchema';

/**
 * Weighted picker: chooses the next item to practise from a pool.
 *
 * Idea (original implementation): items the learner misses recently should come back
 * sooner, items with a high SRS stage less often, and the boost for errors must not
 * swamp small pools. The error boost is therefore bounded and scaled by pool size.
 */

/** Deterministic PRNG (mulberry32). Returns a function producing floats in [0, 1). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PickCandidate {
  id: string;
  /** SRS stage 0..9; missing counts as new (0). */
  srsStage?: number;
  /** Recent wrong answers (any non-negative number; saturates at ERROR_SATURATION). */
  recentErrors?: number;
}

/** Errors beyond this count add no extra weight. */
export const ERROR_SATURATION = 5;
/** Hard ceiling of the error multiplier, whatever the pool size. */
export const MAX_ERROR_MULTIPLIER = 5;

/** Base weight from the SRS stage: 2 for new items down to 0.5 for burned ones. */
export function stageWeight(srsStage = 0): number {
  const stage = Math.max(0, Math.min(MAX_SRS_STAGE, srsStage));
  return 2 - (stage / MAX_SRS_STAGE) * 1.5;
}

/**
 * Largest multiplier an item with saturated errors can receive in a pool of `poolSize`.
 * 1 for a pool of one, growing by 0.5 per extra item up to MAX_ERROR_MULTIPLIER, so that a
 * missed item cannot dominate a tiny pool.
 */
export function maxErrorMultiplier(poolSize: number): number {
  return Math.min(MAX_ERROR_MULTIPLIER, Math.max(1, 1 + (poolSize - 1) * 0.5));
}

/** Weight of one candidate inside a pool of `poolSize` items. Always > 0. */
export function candidateWeight(candidate: PickCandidate, poolSize: number): number {
  const severity = Math.min(Math.max(candidate.recentErrors ?? 0, 0), ERROR_SATURATION) / ERROR_SATURATION;
  const multiplier = 1 + severity * (maxErrorMultiplier(poolSize) - 1);
  return stageWeight(candidate.srsStage) * multiplier;
}

export interface PickOptions {
  /** RNG returning [0, 1). Defaults to Math.random; pass createRng(seed) in tests. */
  rng?: () => number;
  /** Id picked last time: avoided unless it is the only choice. */
  lastId?: string | null;
  /** Ids that must not be picked (ignored if that would leave nothing). */
  exclude?: ReadonlySet<string>;
}

/** Picks one candidate. Throws on an empty pool. */
export function pickWeighted<T extends PickCandidate>(pool: readonly T[], options: PickOptions = {}): T {
  if (pool.length === 0) throw new Error('Cannot pick from an empty pool');
  const rng = options.rng ?? Math.random;
  const blocked = (c: T): boolean => c.id === options.lastId || (options.exclude?.has(c.id) ?? false);
  let available = pool.filter((c) => !blocked(c));
  if (available.length === 0) available = pool.filter((c) => !(options.exclude?.has(c.id) ?? false));
  if (available.length === 0) available = [...pool];
  const weights = available.map((c) => candidateWeight(c, pool.length));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let ticket = rng() * total;
  for (let i = 0; i < available.length; i++) {
    ticket -= weights[i]!;
    if (ticket < 0) return available[i]!;
  }
  return available[available.length - 1]!;
}

/** Stateful picker that remembers the last item so it never repeats back to back. */
export function createPicker(options: { rng?: () => number; seed?: number } = {}): {
  next: <T extends PickCandidate>(pool: readonly T[]) => T;
  reset: () => void;
} {
  const rng = options.rng ?? (options.seed !== undefined ? createRng(options.seed) : Math.random);
  let lastId: string | null = null;
  return {
    next: (pool) => {
      const picked = pickWeighted(pool, { rng, lastId });
      lastId = picked.id;
      return picked;
    },
    reset: () => {
      lastId = null;
    },
  };
}

/**
 * Builds a candidate from a stored item. Recent errors are estimated from the item's
 * `weight` (each wrong answer adds 2, each correct one removes 1, floor 1).
 */
export function candidateFromItem(id: string, item?: Pick<ItemState, 'srsStage' | 'weight'>): PickCandidate {
  if (!item) return { id };
  return { id, srsStage: item.srsStage, recentErrors: Math.max(0, (item.weight - 1) / 2) };
}
