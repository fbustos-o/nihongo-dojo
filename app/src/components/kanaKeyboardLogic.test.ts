import { describe, expect, it } from 'vitest';
import { backspace, GYO, toggleDakuten, toggleHandakuten, toggleSmall, toScript } from './kanaKeyboardLogic';

describe('kana keyboard transforms', () => {
  it('dakuten toggles on the last char only', () => {
    expect(toggleDakuten('か')).toBe('が');
    expect(toggleDakuten('が')).toBe('か');
    expect(toggleDakuten('あさ')).toBe('あざ');
    expect(toggleDakuten('は')).toBe('ば');
    expect(toggleDakuten('ぱ')).toBe('ば');
    expect(toggleDakuten('う')).toBe('ゔ');
    expect(toggleDakuten('ん')).toBe('ん');
    expect(toggleDakuten('')).toBe('');
  });

  it('handakuten: は→ば→ぱ and back', () => {
    expect(toggleHandakuten(toggleDakuten('は'))).toBe('ぱ');
    expect(toggleHandakuten('ぱ')).toBe('は');
    expect(toggleHandakuten('か')).toBe('か');
  });

  it('works for katakana', () => {
    expect(toggleDakuten('カ')).toBe('ガ');
    expect(toggleDakuten('ウ')).toBe('ヴ');
    expect(toggleHandakuten('ハ')).toBe('パ');
    expect(toggleSmall('ツ')).toBe('ッ');
    expect(toggleSmall('イ')).toBe('ィ');
  });

  it('small kana toggle', () => {
    expect(toggleSmall('つ')).toBe('っ');
    expect(toggleSmall('っ')).toBe('つ');
    expect(toggleSmall('きや')).toBe('きゃ');
    expect(toggleSmall('ゆ')).toBe('ゅ');
    expect(toggleSmall('よ')).toBe('ょ');
    expect(toggleSmall('あ')).toBe('ぁ');
    expect(toggleSmall('ん')).toBe('ん');
  });

  it('backspace and script conversion', () => {
    expect(backspace('あい')).toBe('あ');
    expect(backspace('')).toBe('');
    expect(toScript('か', 'katakana')).toBe('カ');
    expect(toScript('ー', 'katakana')).toBe('ー');
  });

  it('gojūon table has 10 rows of 5 slots and 46 kana', () => {
    expect(GYO).toHaveLength(10);
    expect(GYO.every((g) => g.kana.length === 5)).toBe(true);
    expect(GYO.flatMap((g) => g.kana).filter(Boolean)).toHaveLength(46);
  });
});
