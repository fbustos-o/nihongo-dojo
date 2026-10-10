import { describe, expect, it } from 'vitest';
import type { ItemState } from '../state/progressSchema';
import { createRng } from './picker';
import {
  NEVER_DUE,
  STAGE_INTERVAL_MS,
  applyAnswer,
  dueCount,
  dueItems,
  dueTimeFor,
  isBurned,
  isDue,
  isGuruOrAbove,
  nextStage,
  reviewQueue,
  stageCounts,
  stageGroupName,
  stageName,
} from './srs';

const H = 3_600_000;
const D = 24 * H;
const NOW = 1_000_000_000_000;

const item = (id: string, over: Partial<ItemState> = {}): ItemState => ({
  itemId: id,
  kind: 'word',
  srsStage: 1,
  correct: 0,
  wrong: 0,
  lastSeen: NOW - D,
  nextDue: NOW - H,
  weight: 1,
  ...over,
});

describe('stageName', () => {
  it.each([
    [0, 'Nuevo'],
    [1, 'Aprendiz 1'],
    [2, 'Aprendiz 2'],
    [3, 'Aprendiz 3'],
    [4, 'Aprendiz 4'],
    [5, 'Guru 1'],
    [6, 'Guru 2'],
    [7, 'Maestro'],
    [8, 'Iluminado'],
    [9, 'Quemado'],
  ])('%i -> %s', (stage, name) => {
    expect(stageName(stage)).toBe(name);
  });
  it('clamps out-of-range stages and groups names', () => {
    expect(stageName(-3)).toBe('Nuevo');
    expect(stageName(42)).toBe('Quemado');
    expect(stageGroupName(3)).toBe('Aprendiz');
    expect(stageGroupName(6)).toBe('Guru');
    expect(stageGroupName(7)).toBe('Maestro');
  });
  it('Guru and burned thresholds', () => {
    expect(isGuruOrAbove(4)).toBe(false);
    expect(isGuruOrAbove(5)).toBe(true);
    expect(isBurned(8)).toBe(false);
    expect(isBurned(9)).toBe(true);
  });
});

describe('intervals', () => {
  it('follow 4h, 8h, 1d, 2d, 1w, 2w, 1mo, 4mo, then never', () => {
    expect(STAGE_INTERVAL_MS).toEqual([0, 4 * H, 8 * H, D, 2 * D, 7 * D, 14 * D, 30 * D, 120 * D, null]);
    expect(dueTimeFor(1, NOW)).toBe(NOW + 4 * H);
    expect(dueTimeFor(5, NOW)).toBe(NOW + 7 * D);
    expect(dueTimeFor(8, NOW)).toBe(NOW + 120 * D);
    expect(dueTimeFor(9, NOW)).toBe(NEVER_DUE);
  });
});

describe('nextStage', () => {
  it('advances by one when correct and stops at Quemado', () => {
    expect(nextStage(0, true)).toBe(1);
    expect(nextStage(4, true)).toBe(5);
    expect(nextStage(8, true)).toBe(9);
    expect(nextStage(9, true)).toBe(9);
  });

  it('drops ceil(errors/2) below Guru', () => {
    expect(nextStage(4, false, 1)).toBe(3);
    expect(nextStage(4, false, 2)).toBe(3);
    expect(nextStage(4, false, 3)).toBe(2);
    expect(nextStage(4, false, 4)).toBe(2);
    expect(nextStage(4, false, 5)).toBe(1);
  });

  it('drops twice as much from Guru on', () => {
    expect(nextStage(5, false, 1)).toBe(3);
    expect(nextStage(6, false, 1)).toBe(4);
    expect(nextStage(7, false, 2)).toBe(5);
    expect(nextStage(8, false, 3)).toBe(4);
    expect(nextStage(9, false, 1)).toBe(7);
  });

  it('never drops below 1 for seen items', () => {
    expect(nextStage(1, false, 1)).toBe(1);
    expect(nextStage(2, false, 9)).toBe(1);
    expect(nextStage(5, false, 20)).toBe(1);
  });

  it('a new item answered wrong stays at 0', () => {
    expect(nextStage(0, false)).toBe(0);
  });

  it('treats errors < 1 as one error', () => {
    expect(nextStage(4, false, 0)).toBe(3);
  });
});

describe('applyAnswer', () => {
  it('is pure and updates counters, lastSeen and nextDue', () => {
    const before = item('a', { srsStage: 2 });
    const after = applyAnswer(before, true, NOW);
    expect(before.srsStage).toBe(2);
    expect(after).toMatchObject({ srsStage: 3, correct: 1, wrong: 0, lastSeen: NOW, nextDue: NOW + D });
  });
  it('wrong answers lower the stage and raise the weight', () => {
    const after = applyAnswer(item('a', { srsStage: 5, weight: 1 }), false, NOW);
    expect(after).toMatchObject({ srsStage: 3, wrong: 1, nextDue: NOW + D });
    expect(after.weight).toBe(3);
  });
  it('honours the errors argument', () => {
    expect(applyAnswer(item('a', { srsStage: 4 }), false, NOW, 3).srsStage).toBe(2);
  });
  it('first correct answer starts at Aprendiz 1 due in 4h', () => {
    const fresh = item('n', { srsStage: 0, lastSeen: 0, nextDue: 0 });
    expect(applyAnswer(fresh, true, NOW)).toMatchObject({ srsStage: 1, nextDue: NOW + 4 * H });
  });
  it('first wrong answer keeps the item new and immediately due', () => {
    const fresh = item('n', { srsStage: 0, lastSeen: 0, nextDue: 0 });
    const after = applyAnswer(fresh, false, NOW);
    expect(after.srsStage).toBe(0);
    expect(isDue(after, NOW)).toBe(true);
  });
  it('burning removes the item from the queue', () => {
    const burned = applyAnswer(item('b', { srsStage: 8 }), true, NOW);
    expect(burned.srsStage).toBe(9);
    expect(burned.nextDue).toBe(NEVER_DUE);
    expect(dueItems([burned], NOW + 1000 * D)).toEqual([]);
  });
  it('weight never drops below 1', () => {
    expect(applyAnswer(item('a', { weight: 1 }), true, NOW).weight).toBe(1);
  });
});

describe('dueItems / reviewQueue', () => {
  const items = {
    'word:late': item('late', { nextDue: NOW - 5 * H }),
    'word:early': item('early', { nextDue: NOW - 1 * H }),
    'word:future': item('future', { nextDue: NOW + H }),
    'word:exact': item('exact', { nextDue: NOW }),
    'word:new': item('new', { srsStage: 0, lastSeen: 0, nextDue: 0 }),
    'word:burned': item('burned', { srsStage: 9, nextDue: NEVER_DUE }),
  };

  it('returns seen, unburned, overdue items, most overdue first', () => {
    expect(dueItems(items, NOW).map((i) => i.itemId)).toEqual(['late', 'early', 'exact']);
  });
  it('accepts arrays too and does not mutate the input', () => {
    const arr = Object.values(items);
    const copy = [...arr];
    expect(dueItems(arr, NOW)).toHaveLength(3);
    expect(arr).toEqual(copy);
  });
  it('depends on the injected time', () => {
    expect(dueItems(items, NOW - 10 * H)).toEqual([]);
    expect(dueItems(items, NOW + 2 * H)).toHaveLength(4);
    expect(dueCount(items, NOW)).toBe(3);
  });
  it('limits the queue', () => {
    expect(reviewQueue(items, NOW, { limit: 2 }).map((i) => i.itemId)).toEqual(['late', 'early']);
    expect(reviewQueue(items, NOW, { limit: 0 })).toEqual([]);
  });
  it('shuffles reproducibly with a seeded rng and keeps the same members', () => {
    const many: Record<string, ItemState> = {};
    for (let i = 0; i < 20; i++) many[`word:${i}`] = item(`w${i}`, { nextDue: NOW - (i + 1) * H });
    const a = reviewQueue(many, NOW, { rng: createRng(7) }).map((i) => i.itemId);
    const b = reviewQueue(many, NOW, { rng: createRng(7) }).map((i) => i.itemId);
    const plain = reviewQueue(many, NOW).map((i) => i.itemId);
    expect(a).toEqual(b);
    expect(a).not.toEqual(plain);
    expect([...a].sort()).toEqual([...plain].sort());
  });
  it('stageCounts groups by stage name', () => {
    expect(stageCounts(items)).toEqual({ Aprendiz: 4, Nuevo: 1, Quemado: 1 });
  });
});
