import { describe, expect, it } from 'vitest';
import type { Dialogue } from '../../domain/schema';
import { cappedRounds } from './dialoguesLogic';

const d = { id: 'x', title: 'x', lines: ['A', 'B', 'A', 'B'].map((speaker) => ({ speaker, ja: 'あ', romaji: 'a', es: 'a' })) } as unknown as Dialogue;

describe('cappedRounds (QA-027)', () => {
  it('caps thin pools at 1.5 rounds per learner turn and keeps endless sessions endless', () => {
    expect(cappedRounds(15, [d], 'B')).toBe(3);
    expect(cappedRounds(15, [d, d, d, d, d, d], 'B')).toBe(15);
    expect(cappedRounds(undefined, [d], 'B')).toBeUndefined();
  });
});
