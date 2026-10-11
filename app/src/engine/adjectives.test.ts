import { describe, expect, it } from 'vitest';
import {
  ADJ_FORM_LABELS_ES,
  I_ADJ_FORM_IDS,
  NA_ADJ_FORM_IDS,
  NOUN_FORM_IDS,
  conjugateIAdjective,
  conjugateNaAdjective,
  conjugateNoun,
  iAdjStem,
} from './adjectives';

/** [dictionary, present, past, negative, negativePast, adverb, te] */
const I_TABLE: [string, string, string, string, string, string][] = [
  ['たかい', 'たかかったです', 'たかくないです', 'たかくなかったです', 'たかく', 'たかくて'],
  ['やすい', 'やすかったです', 'やすくないです', 'やすくなかったです', 'やすく', 'やすくて'],
  ['おいしい', 'おいしかったです', 'おいしくないです', 'おいしくなかったです', 'おいしく', 'おいしくて'],
  ['おおきい', 'おおきかったです', 'おおきくないです', 'おおきくなかったです', 'おおきく', 'おおきくて'],
  ['ちいさい', 'ちいさかったです', 'ちいさくないです', 'ちいさくなかったです', 'ちいさく', 'ちいさくて'],
  ['あたらしい', 'あたらしかったです', 'あたらしくないです', 'あたらしくなかったです', 'あたらしく', 'あたらしくて'],
  ['ふるい', 'ふるかったです', 'ふるくないです', 'ふるくなかったです', 'ふるく', 'ふるくて'],
  ['むずかしい', 'むずかしかったです', 'むずかしくないです', 'むずかしくなかったです', 'むずかしく', 'むずかしくて'],
  ['たのしい', 'たのしかったです', 'たのしくないです', 'たのしくなかったです', 'たのしく', 'たのしくて'],
  ['あつい', 'あつかったです', 'あつくないです', 'あつくなかったです', 'あつく', 'あつくて'],
  ['さむい', 'さむかったです', 'さむくないです', 'さむくなかったです', 'さむく', 'さむくて'],
  ['いそがしい', 'いそがしかったです', 'いそがしくないです', 'いそがしくなかったです', 'いそがしく', 'いそがしくて'],
  ['いい', 'よかったです', 'よくないです', 'よくなかったです', 'よく', 'よくて'],
  ['かっこいい', 'かっこよかったです', 'かっこよくないです', 'かっこよくなかったです', 'かっこよく', 'かっこよくて'],
];

describe.each(I_TABLE)('い-adjective %s', (dict, past, neg, negPast, adverb, te) => {
  const f = conjugateIAdjective(dict);
  it('matches the teacher table', () => {
    expect(f.dictionary.kana).toBe(dict);
    expect(f.present.kana).toBe(`${dict}です`);
    expect(f.past.kana).toBe(past);
    expect(f.negative.kana).toBe(neg);
    expect(f.negativePast.kana).toBe(negPast);
    expect(f.adverb.kana).toBe(adverb);
    expect(f.te.kana).toBe(te);
  });
  it('plain forms drop です', () => {
    expect(f.plainPast.kana).toBe(past.replace(/です$/, ''));
    expect(f.plainNegative.kana).toBe(neg.replace(/です$/, ''));
    expect(f.plainNegativePast.kana).toBe(negPast.replace(/です$/, ''));
  });
});

describe('い-adjective details', () => {
  it('いい is irregular only outside the dictionary form', () => {
    const f = conjugateIAdjective('いい');
    expect(f.dictionary.kana).toBe('いい');
    expect(f.present.kana).toBe('いいです');
    expect(f.plainPast.kana).toBe('よかった');
    expect(f.plainNegative.kana).toBe('よくない');
  });

  it('keeps romaji', () => {
    expect(conjugateIAdjective('たかい').past.romaji).toBe('takakattadesu');
    expect(conjugateIAdjective('いい').negative.romaji).toBe('yokunaidesu');
  });

  it('stem', () => {
    expect(iAdjStem('たかい')).toBe('たか');
    expect(iAdjStem('いい')).toBe('よ');
  });

  it('rejects words not ending in い', () => {
    expect(() => conjugateIAdjective('きれ')).toThrow();
    expect(() => conjugateIAdjective('')).toThrow();
  });
});

describe('な-adjectives', () => {
  it.each(['きれい', 'しずか', 'ゆうめい', 'げんき', 'すき', 'じょうず'])('%s', (a) => {
    const f = conjugateNaAdjective(a);
    expect(f.present.kana).toBe(`${a}です`);
    expect(f.past.kana).toBe(`${a}でした`);
    expect(f.negative.kana).toBe(`${a}じゃないです`);
    expect(f.negativePast.kana).toBe(`${a}じゃなかったです`);
    expect(f.adverb.kana).toBe(`${a}に`);
    expect(f.te.kana).toBe(`${a}で`);
    expect(f.attributive.kana).toBe(`${a}な`);
  });

  it('accepts ではない / じゃありません as alternatives', () => {
    const f = conjugateNaAdjective('きれい');
    expect(f.negative.alternatives).toContain('きれいではないです');
    expect(f.negative.alternatives).toContain('きれいじゃありません');
    expect(f.negativePast.alternatives).toContain('きれいではなかったです');
    expect(f.negativePast.alternatives).toContain('きれいじゃありませんでした');
    expect(f.present.alternatives).toEqual([]);
  });

  it('romaji', () => {
    expect(conjugateNaAdjective('げんき').negative.romaji).toBe('genkijanaidesu');
  });
});

describe('noun + です', () => {
  it.each(['がくせい', 'せんせい', 'ほん', 'いしゃ'])('%s', (n) => {
    const f = conjugateNoun(n);
    expect(f.present.kana).toBe(`${n}です`);
    expect(f.past.kana).toBe(`${n}でした`);
    expect(f.negative.kana).toBe(`${n}じゃないです`);
    expect(f.negativePast.kana).toBe(`${n}じゃなかったです`);
  });
  it('rejects empty input', () => {
    expect(() => conjugateNoun('')).toThrow();
    expect(() => conjugateNaAdjective('')).toThrow();
  });
});

describe('labels', () => {
  it('cover all form ids', () => {
    for (const id of [...I_ADJ_FORM_IDS, ...NA_ADJ_FORM_IDS, ...NOUN_FORM_IDS]) {
      expect(ADJ_FORM_LABELS_ES[id].label).toBeTruthy();
    }
  });
});

describe('QA-004: only いい-type compounds use よ-', () => {
  it.each([
    ['かわいい', 'かわいかったです', 'かわいくないです'],
    ['おいしい', 'おいしかったです', 'おいしくないです'],
    ['おおきい', 'おおきかったです', 'おおきくないです'],
    ['いい', 'よかったです', 'よくないです'],
    ['かっこいい', 'かっこよかったです', 'かっこよくないです'],
    ['あたまがいい', 'あたまがよかったです', 'あたまがよくないです'],
  ])('%s', (dict, past, negative) => {
    const f = conjugateIAdjective(dict);
    expect([f.past.kana, f.negative.kana]).toEqual([past, negative]);
  });
});
