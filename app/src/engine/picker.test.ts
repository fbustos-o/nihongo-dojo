import { describe, expect, it } from 'vitest';
import {
  ERROR_SATURATION,
  MAX_ERROR_MULTIPLIER,
  candidateFromItem,
  candidateWeight,
  createPicker,
  createRng,
  maxErrorMultiplier,
  pickWeighted,
  stageWeight,
  type PickCandidate,
} from './picker';

const pool = (n: number, over: (i: number) => Partial<PickCandidate> = () => ({})): PickCandidate[] =>
  Array.from({ length: n }, (_, i) => ({ id: `i${i}`, ...over(i) }));

function frequencies(items: PickCandidate[], draws: number, seed = 1): Map<string, number> {
  const picker = createPicker({ seed });
  const counts = new Map<string, number>();
  for (let i = 0; i < draws; i++) {
    const id = picker.next(items).id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

describe('createRng', () => {
  it('is deterministic and within [0, 1)', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 200; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it('differs between seeds', () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });
});

describe('weights', () => {
  it('stage weight decreases with the stage', () => {
    expect(stageWeight(0)).toBe(2);
    expect(stageWeight(9)).toBeCloseTo(0.5);
    expect(stageWeight(undefined)).toBe(2);
    for (let s = 0; s < 9; s++) expect(stageWeight(s)).toBeGreaterThan(stageWeight(s + 1));
    expect(stageWeight(99)).toBeCloseTo(0.5);
    expect(stageWeight(-4)).toBe(2);
  });

  it('error multiplier is bounded and grows with the pool', () => {
    expect(maxErrorMultiplier(1)).toBe(1);
    expect(maxErrorMultiplier(2)).toBe(1.5);
    expect(maxErrorMultiplier(5)).toBe(3);
    expect(maxErrorMultiplier(1000)).toBe(MAX_ERROR_MULTIPLIER);
    expect(maxErrorMultiplier(0)).toBe(1);
  });

  it('errors raise the weight, saturate, and never exceed the cap', () => {
    const base = candidateWeight({ id: 'a', srsStage: 3 }, 20);
    const some = candidateWeight({ id: 'a', srsStage: 3, recentErrors: 2 }, 20);
    const max = candidateWeight({ id: 'a', srsStage: 3, recentErrors: ERROR_SATURATION }, 20);
    expect(some).toBeGreaterThan(base);
    expect(max).toBeGreaterThan(some);
    expect(max).toBeCloseTo(base * MAX_ERROR_MULTIPLIER);
    expect(candidateWeight({ id: 'a', srsStage: 3, recentErrors: 1000 }, 20)).toBeCloseTo(max);
    expect(candidateWeight({ id: 'a', recentErrors: -3 }, 20)).toBe(candidateWeight({ id: 'a' }, 20));
  });

  it('the boost is smaller in a small pool than in a large one', () => {
    const c = { id: 'a', recentErrors: 5 };
    expect(candidateWeight(c, 2) / stageWeight(0)).toBeLessThan(candidateWeight(c, 20) / stageWeight(0));
  });

  it('weights are always positive', () => {
    expect(candidateWeight({ id: 'x', srsStage: 9 }, 1)).toBeGreaterThan(0);
  });
});

describe('pickWeighted', () => {
  it('throws on an empty pool', () => {
    expect(() => pickWeighted([])).toThrow();
  });

  it('returns the only item', () => {
    expect(pickWeighted([{ id: 'solo' }], { rng: createRng(1), lastId: 'solo' }).id).toBe('solo');
  });

  it('is reproducible with a seeded rng', () => {
    const items = pool(10);
    const seq = (seed: number) => {
      const rng = createRng(seed);
      return Array.from({ length: 30 }, () => pickWeighted(items, { rng }).id);
    };
    expect(seq(5)).toEqual(seq(5));
    expect(seq(5)).not.toEqual(seq(6));
  });

  it('respects the rng extremes', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(pickWeighted(items, { rng: () => 0 }).id).toBe('a');
    expect(pickWeighted(items, { rng: () => 0.999999 }).id).toBe('c');
  });

  it('skips lastId and excluded ids', () => {
    const items = pool(3);
    for (let i = 0; i < 50; i++) {
      const picked = pickWeighted(items, { rng: createRng(i), lastId: 'i0', exclude: new Set(['i1']) });
      expect(picked.id).toBe('i2');
    }
  });

  it('falls back when everything is excluded', () => {
    const items = pool(2);
    expect(['i0', 'i1']).toContain(pickWeighted(items, { exclude: new Set(['i0', 'i1']) }).id);
    expect(pickWeighted(items, { lastId: 'i0', exclude: new Set(['i1']) }).id).toBe('i0');
  });
});

describe('createPicker', () => {
  it('never repeats the same item twice in a row', () => {
    const picker = createPicker({ seed: 3 });
    const items = pool(4, (i) => ({ recentErrors: i === 0 ? 5 : 0 }));
    let last = '';
    for (let i = 0; i < 2000; i++) {
      const id = picker.next(items).id;
      expect(id).not.toBe(last);
      last = id;
    }
  });

  it('alternates in a pool of two and can reset', () => {
    const picker = createPicker({ seed: 1 });
    const items = pool(2);
    const a = picker.next(items).id;
    expect(picker.next(items).id).not.toBe(a);
    picker.reset();
    expect(picker.next(items)).toBeDefined();
  });

  it('missed items appear more often than others, but bounded', () => {
    const items = pool(10, (i) => ({ srsStage: 3, recentErrors: i === 0 ? 5 : 0 }));
    const counts = frequencies(items, 20000);
    const missed = counts.get('i0')!;
    const others = [...counts.entries()].filter(([id]) => id !== 'i0').map(([, n]) => n);
    const avgOther = others.reduce((a, b) => a + b, 0) / others.length;
    expect(missed).toBeGreaterThan(avgOther * 2);
    expect(missed).toBeLessThan(avgOther * (MAX_ERROR_MULTIPLIER + 1));
  });

  it('low-stage items are favoured over burned ones', () => {
    const items = [
      { id: 'new', srsStage: 0 },
      { id: 'burned', srsStage: 9 },
      { id: 'burned2', srsStage: 9 },
    ];
    const counts = frequencies(items, 12000);
    expect(counts.get('new')!).toBeGreaterThan(counts.get('burned')!);
  });

  it('every item in the pool is eventually picked', () => {
    const counts = frequencies(pool(8, (i) => ({ srsStage: i })), 4000);
    expect(counts.size).toBe(8);
  });

  it('a missed item cannot dominate a pool of two', () => {
    const items: PickCandidate[] = [
      { id: 'bad', recentErrors: 5 },
      { id: 'good' },
    ];
    const counts = frequencies(items, 4000);
    expect(counts.get('good')!).toBeGreaterThan(1000);
  });
});

describe('candidateFromItem', () => {
  it('estimates recent errors from the item weight', () => {
    expect(candidateFromItem('a')).toEqual({ id: 'a' });
    expect(candidateFromItem('a', { srsStage: 2, weight: 1 })).toEqual({ id: 'a', srsStage: 2, recentErrors: 0 });
    expect(candidateFromItem('a', { srsStage: 2, weight: 5 })).toEqual({ id: 'a', srsStage: 2, recentErrors: 2 });
  });
});
