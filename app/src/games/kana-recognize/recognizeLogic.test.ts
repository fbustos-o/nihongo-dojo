import { content } from '../../domain/contentLoader';
import { createRng } from '../../engine';
import { buildRecognizeQuestion, scriptPartner } from './recognizeLogic';

const kana = (c: string) => content.kana.find((k) => k.char === c)!;
const known = new Set([...'あいうえおかきくけこ', ...'アイウエオカキクケコシツソン']);

describe('scriptPartner', () => {
  it('pairs hiragana and katakana of the same sound', () => {
    expect(scriptPartner(kana('ア'))?.char).toBe('あ');
    expect(scriptPartner(kana('あ'))?.char).toBe('ア');
    expect(scriptPartner(kana('シャ'))?.char).toBe('しゃ');
    expect(scriptPartner(kana('ッ'))?.char).toBe('っ');
  });
  it('has no partner for ー and the extended-only kana', () => {
    expect(scriptPartner(kana('ー'))).toBeNull();
    expect(scriptPartner(kana('ティ'))).toBeNull();
    expect(scriptPartner(kana('ヴ'))).toBeNull();
  });
});

describe('buildRecognizeQuestion', () => {
  it('hiragana lessons never get script-pair rounds', () => {
    for (let seed = 1; seed < 30; seed++) {
      const q = buildRecognizeQuestion(kana('か'), { isNew: false, known, rng: createRng(seed), scriptPairs: true });
      expect(q.kind).toBe('type');
    }
  });
  it('new katakana: multiple choice with look-alikes as distractors', () => {
    const q = buildRecognizeQuestion(kana('ツ'), { isNew: true, known, rng: createRng(1), scriptPairs: true });
    expect(q.kind).toBe('choice');
    if (q.kind === 'choice') expect(q.choices.map((k) => k.char)).toEqual(expect.arrayContaining(['ツ', 'シ']));
  });
  it('seen katakana: some rounds are hiragana <-> katakana, both directions', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 200; seed++) {
      const q = buildRecognizeQuestion(kana('カ'), { isNew: false, known, rng: createRng(seed), scriptPairs: true });
      if (q.kind !== 'script-pair') continue;
      expect(q.entry.char).toBe('カ');
      expect(q.shown.char).not.toBe(q.answer.char);
      expect(q.choices.map((k) => k.char)).toContain(q.answer.char);
      expect(q.choices.every((k) => k.script === q.answer.script)).toBe(true);
      expect(q.shown.script).not.toBe(q.answer.script);
      seen.add(`${q.shown.script}->${q.answer.script}`);
    }
    expect([...seen].sort()).toEqual(['hiragana->katakana', 'katakana->hiragana']);
  });
  it('kana without a counterpart (ー) are simply typed', () => {
    for (let seed = 1; seed < 30; seed++) {
      expect(buildRecognizeQuestion(kana('ー'), { isNew: false, known, rng: createRng(seed), scriptPairs: true }).kind).toBe('type');
    }
  });
  it('script pairs are off unless asked for', () => {
    for (let seed = 1; seed < 50; seed++) {
      expect(buildRecognizeQuestion(kana('カ'), { isNew: false, known, rng: createRng(seed) }).kind).toBe('type');
    }
  });
});
