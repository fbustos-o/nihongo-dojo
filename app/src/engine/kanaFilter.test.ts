import { describe, expect, it } from 'vitest';
import {
  filterReadable,
  isReadableWith,
  katakanaToHiragana,
  missingKana,
  splitKanaUnits,
  unlockedKanaForLessons,
} from './kanaFilter';

const set = (s: string): Set<string> => new Set(Array.from(s));
const VOWELS = set('あいうえお');

describe('isReadableWith: basics', () => {
  it('accepts words made of known kana', () => {
    expect(isReadableWith('あい', VOWELS)).toBe(true);
    expect(isReadableWith('いえ', VOWELS)).toBe(true);
    expect(isReadableWith('あおい', VOWELS)).toBe(true);
  });
  it('rejects unknown kana', () => {
    expect(isReadableWith('あか', VOWELS)).toBe(false);
    expect(isReadableWith('かお', VOWELS)).toBe(false);
  });
  it('empty text is trivially readable', () => {
    expect(isReadableWith('', VOWELS)).toBe(true);
    expect(isReadableWith('  。 ', VOWELS)).toBe(true);
  });
  it('hiragana and katakana are separate scripts', () => {
    expect(isReadableWith('アイ', VOWELS)).toBe(false);
    expect(isReadableWith('アイ', set('アイ'))).toBe(true);
    expect(isReadableWith('あ', set('ア'))).toBe(false);
  });
  it('katakanaAsHiragana shows locked katakana as hiragana', () => {
    expect(isReadableWith('アイ', VOWELS, { katakanaAsHiragana: true })).toBe(true);
    expect(isReadableWith('カイ', VOWELS, { katakanaAsHiragana: true })).toBe(false);
  });
  it('kanji and latin letters are never readable', () => {
    expect(isReadableWith('日', VOWELS)).toBe(false);
    expect(isReadableWith('あA', VOWELS)).toBe(false);
    expect(isReadableWith('食べる', set('べる'))).toBe(false);
  });
});

describe('isReadableWith: spaces and punctuation', () => {
  it('ignores spaces, punctuation, symbols and digits', () => {
    expect(isReadableWith('あ い。', VOWELS)).toBe(true);
    expect(isReadableWith('あ、い！う？', VOWELS)).toBe(true);
    expect(isReadableWith('「あい」', VOWELS)).toBe(true);
    expect(isReadableWith('あ　い', VOWELS)).toBe(true);
    expect(isReadableWith('あい…', VOWELS)).toBe(true);
    expect(isReadableWith('あ〜い', VOWELS)).toBe(true);
    expect(isReadableWith('3じ', set('じ'))).toBe(true);
    expect(isReadableWith('あ,い.', VOWELS)).toBe(true);
  });
});

describe('isReadableWith: dakuten', () => {
  it('が is its own kana', () => {
    expect(isReadableWith('が', set('か'))).toBe(false);
    expect(isReadableWith('が', set('かが'))).toBe(true);
  });
  it('decomposed dakuten is normalised', () => {
    expect(isReadableWith('が', set('が'))).toBe(true);
  });
});

describe('isReadableWith: sokuon and long mark', () => {
  it('っ needs to be known', () => {
    const known = set('きて');
    expect(isReadableWith('きって', known)).toBe(false);
    expect(isReadableWith('きって', set('きてっ'))).toBe(true);
  });
  it('ッ needs katakana ッ', () => {
    expect(isReadableWith('カップ', set('カップ'))).toBe(true);
    expect(isReadableWith('カップ', set('カプ'))).toBe(false);
  });
  it('ー needs to be known', () => {
    expect(isReadableWith('コーヒー', set('コヒ'))).toBe(false);
    expect(isReadableWith('コーヒー', set('コヒー'))).toBe(true);
  });
});

describe('isReadableWith: yoon', () => {
  it('accepts a yoon when the unit itself is known', () => {
    expect(isReadableWith('きゃ', set('きゃ'))).toBe(true);
    expect(isReadableWith('しゅ', new Set(['しゅ']))).toBe(true);
  });
  it('accepts a yoon when base kana and small kana are known', () => {
    expect(isReadableWith('きゃ', set('きゃ'.concat('ゃ')))).toBe(true);
    expect(isReadableWith('きょう', set('きょうう'))).toBe(true);
  });
  it('rejects a yoon when only the base kana is known', () => {
    expect(isReadableWith('きゃ', set('き'))).toBe(false);
    expect(isReadableWith('きゃ', set('きあ'))).toBe(false);
  });
  it('rejects a yoon when only the small kana is known', () => {
    expect(isReadableWith('きゃ', set('ゃ'))).toBe(false);
  });
  it('a known unit does not unlock other yoon of the same row', () => {
    expect(isReadableWith('きゅ', new Set(['きゃ']))).toBe(false);
  });
  it('base kana alone still reads when the small kana is absent from the text', () => {
    expect(isReadableWith('きや', set('きや'))).toBe(true);
  });
  it('works in a full word (しゅくだい)', () => {
    expect(isReadableWith('しゅくだい', new Set(['しゅ', 'く', 'だ', 'い']))).toBe(true);
    expect(isReadableWith('しゅくだい', new Set(['し', 'く', 'だ', 'い']))).toBe(false);
  });
  it('katakana extended digraphs (ファ, ティ)', () => {
    expect(isReadableWith('ファイル', new Set(['ファ', 'イ', 'ル']))).toBe(true);
    expect(isReadableWith('ファイル', new Set(['フ', 'ァ', 'イ', 'ル']))).toBe(true);
    expect(isReadableWith('ファイル', new Set(['フ', 'イ', 'ル']))).toBe(false);
  });
});

describe('splitKanaUnits / missingKana', () => {
  it('keeps digraphs together and separates other characters', () => {
    expect(splitKanaUnits('きょうは 日')).toEqual({ units: ['きょ', 'う', 'は'], unreadable: ['日'] });
  });
  it('lists missing kana once', () => {
    expect(missingKana('かかきあ', VOWELS)).toEqual(['か', 'き']);
    expect(missingKana('あ日', VOWELS)).toEqual(['日']);
  });
  it('katakanaToHiragana keeps ー', () => {
    expect(katakanaToHiragana('コーヒー')).toBe('こーひー');
  });
});

describe('filterReadable', () => {
  const words = [
    { id: 'ai', kana: 'あい' },
    { id: 'aka', kana: 'あか' },
    { id: 'ie', kana: 'いえ' },
    { id: 'kohi', kana: 'コーヒー' },
  ];
  it('keeps only fully readable words and preserves order and extra fields', () => {
    expect(filterReadable(words, VOWELS).map((w) => w.id)).toEqual(['ai', 'ie']);
    expect(filterReadable(words, set('あかいえ')).map((w) => w.id)).toEqual(['ai', 'aka', 'ie']);
  });
  it('returns nothing for an empty known set and everything when all is known', () => {
    expect(filterReadable(words, new Set())).toEqual([]);
    expect(filterReadable(words, set('あいかえこひー')).map((w) => w.id)).toEqual(['ai', 'aka', 'ie']);
  });
  it('option katakanaAsHiragana', () => {
    expect(filterReadable(words, set('こひー'), { katakanaAsHiragana: true }).map((w) => w.id)).toEqual(['kohi']);
  });
});

describe('unlockedKanaForLessons', () => {
  const curriculum = [
    { id: 'H1', kana: ['あ', 'い', 'う', 'え', 'お'] },
    { id: 'H2', kana: ['か', 'き'] },
    { id: 'G1' },
    { id: 'H3', kana: ['きゃ'] },
  ];
  it('unions the kana of completed lessons only', () => {
    expect([...unlockedKanaForLessons(curriculum, ['H1'])].sort()).toEqual(['あ', 'い', 'う', 'え', 'お']);
    expect(unlockedKanaForLessons(curriculum, ['H2', 'G1', 'H3'])).toEqual(new Set(['か', 'き', 'きゃ']));
  });
  it('handles nothing completed, unknown ids and any iterable', () => {
    expect(unlockedKanaForLessons(curriculum, []).size).toBe(0);
    expect(unlockedKanaForLessons(curriculum, ['nope']).size).toBe(0);
    expect(unlockedKanaForLessons(curriculum, new Set(['H2'])).size).toBe(2);
  });
  it('integrates with isReadableWith', () => {
    const known = unlockedKanaForLessons(curriculum, ['H1', 'H2']);
    expect(isReadableWith('あき', known)).toBe(true);
    expect(isReadableWith('かけ', known)).toBe(false);
  });
});
