import { content } from '../domain/contentLoader';
import { createRng } from '../engine';
import { CONFUSABLE_GROUPS, confusableChoices, confusableReview, confusablesOf, hasConfusables, pickWithConfusableBoost } from './confusables';

const kana = (c: string) => content.kana.find((k) => k.char === c)!;

describe('confusablesOf', () => {
  it('knows the classic katakana confusions', () => {
    expect(confusablesOf('シ')).toEqual(expect.arrayContaining(['ツ']));
    expect(confusablesOf('ツ')).toEqual(expect.arrayContaining(['シ']));
    expect(confusablesOf('ソ')).toEqual(expect.arrayContaining(['ン']));
    expect(confusablesOf('ン')).toEqual(expect.arrayContaining(['ソ']));
    expect(confusablesOf('ク')).toEqual(expect.arrayContaining(['ケ', 'タ']));
    expect(confusablesOf('ワ')).toEqual(expect.arrayContaining(['ウ', 'フ']));
    expect(confusablesOf('ヌ')).toEqual(expect.arrayContaining(['ス']));
    expect(confusablesOf('チ')).toEqual(expect.arrayContaining(['テ']));
  });
  it('includes katakana <-> hiragana look-alikes in both directions', () => {
    expect(confusablesOf('カ')).toContain('か');
    expect(confusablesOf('か')).toContain('カ');
    expect(confusablesOf('ヘ')).toContain('へ');
    expect(confusablesOf('リ')).toContain('り');
  });
  it('is symmetric and every char exists in kana.json', () => {
    for (const group of CONFUSABLE_GROUPS) {
      for (const a of group) {
        expect(content.kana.some((k) => k.char === a)).toBe(true);
        for (const b of group) if (a !== b) expect(confusablesOf(b)).toContain(a);
      }
    }
    expect(hasConfusables('あ')).toBe(false);
  });
});

describe('confusableReview', () => {
  it('brings back known kana that look like a new one', () => {
    const review = confusableReview(['ツ', 'テ'], new Set(['シ', 'チ', 'ア']));
    expect(review.map((k) => k.char).sort()).toEqual(['シ', 'チ']);
  });
  it('ignores unknown kana and kana of the lesson itself', () => {
    expect(confusableReview(['ツ', 'シ'], new Set(['シ']))).toEqual([]);
    expect(confusableReview(['ツ'], new Set())).toEqual([]);
  });
});

describe('confusableChoices', () => {
  const allowed = new Set(['シ', 'ツ', 'ソ', 'ン', 'ア', 'イ', 'ウ']);
  it('puts the look-alikes first as distractors and never repeats a romaji', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const choices = confusableChoices(kana('シ'), allowed, 4, content.kana, createRng(seed));
      expect(choices).toHaveLength(4);
      expect(choices.map((k) => k.char)).toContain('シ');
      expect(choices.map((k) => k.char)).toContain('ツ');
      expect(new Set(choices.map((k) => k.romaji)).size).toBe(4);
      expect(choices.every((k) => k.script === 'katakana')).toBe(true);
    }
  });
  it('only uses look-alikes the learner already met, falling back to similar kana', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const met = new Set([...'アイウエオカキクケコ', 'ツ']);
      const choices = confusableChoices(kana('ツ'), met, 4, content.kana, createRng(seed));
      expect(choices).toHaveLength(4);
      expect(choices.every((k) => met.has(k.char))).toBe(true);
    }
    // with nothing else met it still returns four distinct options
    for (let seed = 1; seed <= 5; seed++) {
      const choices = confusableChoices(kana('ツ'), new Set(['ツ']), 4, content.kana, createRng(seed));
      expect(new Set(choices.map((k) => k.romaji)).size).toBe(4);
    }
  });
  it('keeps hiragana distractors for a hiragana target', () => {
    const choices = confusableChoices(kana('か'), new Set(['か']), 4, content.kana, createRng(3));
    expect(choices.every((k) => k.script === 'hiragana')).toBe(true);
  });
});

describe('pickWithConfusableBoost', () => {
  const pool = ['ア', 'イ', 'シ', 'ツ', 'ウ', 'エ'].map((id) => ({ id }));
  const first = <T,>(items: readonly T[]): T => items[0]!;
  it('raises the frequency of kana that have look-alikes', () => {
    const rng = createRng(7);
    let boosted = 0;
    const picker = (items: readonly { id: string }[]) => items[Math.floor(rng() * items.length)]!;
    for (let i = 0; i < 400; i++) if (hasConfusables(pickWithConfusableBoost(pool, picker, (p) => hasConfusables(p.id), rng, 0.5).id)) boosted++;
    // without the boost only 2 of 6 would be confusable (~33%); with rate 0.5 it is about 66%
    expect(boosted / 400).toBeGreaterThan(0.55);
  });
  it('does nothing when every kana (or none) has look-alikes', () => {
    expect(pickWithConfusableBoost(pool, first, () => true, () => 0, 1)).toEqual({ id: 'ア' });
    expect(pickWithConfusableBoost(pool, first, () => false, () => 0, 1)).toEqual({ id: 'ア' });
  });
});
