import { content } from '../domain/contentLoader';
import { acceptedRomaji, judgeRomaji, kanaChoices, similarKana } from './kanaUtils';
import { meaningChoices, wordChoices } from './wordUtils';

const kana = (c: string) => content.kana.find((k) => k.char === c)!;

describe('judgeRomaji', () => {
  it('accepts romaji and alt, case-insensitive', () => {
    expect(judgeRomaji('KA', kana('か'))).toBe('correct');
    expect(judgeRomaji(' o ', kana('を'))).toBe('correct');
    expect(judgeRomaji('wo', kana('を'))).toBe('correct');
    expect(judgeRomaji('du', kana('づ'))).toBe('correct');
    expect(judgeRomaji('-', kana('ー'))).toBe('correct');
    expect(judgeRomaji('ltsu', kana('っ'))).toBe('correct');
  });
  it('a different valid kana is wrong, a typo is near', () => {
    expect(judgeRomaji('ki', kana('か'))).toBe('wrong');
    expect(judgeRomaji('shii', kana('し'))).toBe('near');
    expect(judgeRomaji('shl', kana('し'))).toBe('near');
    expect(judgeRomaji('', kana('か'))).toBe('wrong');
    expect(acceptedRomaji(kana('ぢ'))).toEqual(['ji', 'di']);
  });
});

describe('distractors', () => {
  it('gives 4 distinct options of the same script containing the target', () => {
    for (const c of ['あ', 'し', 'ぢ', 'きゃ', 'ン', 'ん']) {
      const options = kanaChoices(kana(c));
      expect(options).toHaveLength(4);
      expect(new Set(options.map((o) => o.romaji)).size).toBe(4);
      expect(options.map((o) => o.char)).toContain(c);
      expect(options.every((o) => o.script === kana(c).script)).toBe(true);
    }
  });
  it('prefers the same row and neighbours', () => {
    const near = similarKana(kana('か'), 3, content.kana, () => 0.5).map((k) => k.row);
    expect(near.every((r) => ['a', 'ka', 'sa'].includes(r))).toBe(true);
  });
  it('word and meaning choices include the target once and are distinct', () => {
    const words = content.vocab.slice(0, 30);
    const w = words[0]!;
    const meanings = meaningChoices(w, 4, words);
    expect(meanings.filter((m) => m.correct)).toHaveLength(1);
    expect(new Set(meanings.map((m) => m.text)).size).toBe(meanings.length);
    expect(wordChoices(w, words).map((x) => x.id)).toContain(w.id);
  });
});
