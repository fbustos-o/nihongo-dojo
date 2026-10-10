import { describe, expect, it } from 'vitest';
import {
  FORM_LABELS_ES,
  VERB_FORM_IDS,
  conjugateVerb,
  conjugateVerbForm,
  masuStem,
  plainNegative,
  teForm,
  type VerbGroup,
} from './conjugate';

/** [dictionary, group, ます-stem, て-form, plain negative] taken from the teacher's tables. */
const TABLE: [string, VerbGroup, string, string, string][] = [
  // Group I (u-verbs)
  ['かく', 'u', 'かき', 'かいて', 'かかない'],
  ['あるく', 'u', 'あるき', 'あるいて', 'あるかない'],
  ['きく', 'u', 'きき', 'きいて', 'きかない'],
  ['いく', 'u', 'いき', 'いって', 'いかない'],
  ['およぐ', 'u', 'およぎ', 'およいで', 'およがない'],
  ['いそぐ', 'u', 'いそぎ', 'いそいで', 'いそがない'],
  ['はなす', 'u', 'はなし', 'はなして', 'はなさない'],
  ['かす', 'u', 'かし', 'かして', 'かさない'],
  ['まつ', 'u', 'まち', 'まって', 'またない'],
  ['たつ', 'u', 'たち', 'たって', 'たたない'],
  ['もつ', 'u', 'もち', 'もって', 'もたない'],
  ['しぬ', 'u', 'しに', 'しんで', 'しなない'],
  ['あそぶ', 'u', 'あそび', 'あそんで', 'あそばない'],
  ['よぶ', 'u', 'よび', 'よんで', 'よばない'],
  ['よむ', 'u', 'よみ', 'よんで', 'よまない'],
  ['のむ', 'u', 'のみ', 'のんで', 'のまない'],
  ['すむ', 'u', 'すみ', 'すんで', 'すまない'],
  ['かえる', 'u', 'かえり', 'かえって', 'かえらない'],
  ['はいる', 'u', 'はいり', 'はいって', 'はいらない'],
  ['はしる', 'u', 'はしり', 'はしって', 'はしらない'],
  ['きる', 'u', 'きり', 'きって', 'きらない'], // 切る "cut"
  ['いる', 'u', 'いり', 'いって', 'いらない'], // 要る "need"
  ['おわる', 'u', 'おわり', 'おわって', 'おわらない'],
  ['つくる', 'u', 'つくり', 'つくって', 'つくらない'],
  ['のる', 'u', 'のり', 'のって', 'のらない'],
  ['とる', 'u', 'とり', 'とって', 'とらない'],
  ['わかる', 'u', 'わかり', 'わかって', 'わからない'],
  ['かう', 'u', 'かい', 'かって', 'かわない'],
  ['あう', 'u', 'あい', 'あって', 'あわない'],
  ['つかう', 'u', 'つかい', 'つかって', 'つかわない'],
  ['てつだう', 'u', 'てつだい', 'てつだって', 'てつだわない'],
  ['ある', 'u', 'あり', 'あって', 'ない'],
  // Group II (ru-verbs)
  ['たべる', 'ru', 'たべ', 'たべて', 'たべない'],
  ['ねる', 'ru', 'ね', 'ねて', 'ねない'],
  ['おきる', 'ru', 'おき', 'おきて', 'おきない'],
  ['みる', 'ru', 'み', 'みて', 'みない'],
  ['あける', 'ru', 'あけ', 'あけて', 'あけない'],
  ['しめる', 'ru', 'しめ', 'しめて', 'しめない'],
  ['みせる', 'ru', 'みせ', 'みせて', 'みせない'],
  ['つける', 'ru', 'つけ', 'つけて', 'つけない'],
  ['はじめる', 'ru', 'はじめ', 'はじめて', 'はじめない'],
  ['いる', 'ru', 'い', 'いて', 'いない'], // 居る "exist"
  // Group III
  ['くる', 'irregular', 'き', 'きて', 'こない'],
  ['する', 'irregular', 'し', 'して', 'しない'],
  ['べんきょうする', 'irregular', 'べんきょうし', 'べんきょうして', 'べんきょうしない'],
];

describe.each(TABLE)('%s (%s)', (dict, group, stem, te, nai) => {
  const f = conjugateVerb(dict, group);
  const k = (id: keyof typeof f) => f[id].kana;

  it('polite forms', () => {
    expect(k('masu')).toBe(`${stem}ます`);
    expect(k('masen')).toBe(`${stem}ません`);
    expect(k('mashita')).toBe(`${stem}ました`);
    expect(k('masendeshita')).toBe(`${stem}ませんでした`);
    expect(k('mashou')).toBe(`${stem}ましょう`);
    expect(k('mashouka')).toBe(`${stem}ましょうか`);
    expect(k('masenka')).toBe(`${stem}ませんか`);
    expect(k('taidesu')).toBe(`${stem}たいです`);
    expect(k('takunaidesu')).toBe(`${stem}たくないです`);
  });

  it('te-form family', () => {
    expect(k('te')).toBe(te);
    expect(k('tekudasai')).toBe(`${te}ください`);
    expect(k('teimasu')).toBe(`${te}います`);
    expect(k('temoiidesu')).toBe(`${te}もいいです`);
    expect(k('tehaikemasen')).toBe(`${te}はいけません`);
  });

  it('plain forms', () => {
    expect(k('dictionary')).toBe(dict);
    expect(k('nai')).toBe(nai);
    expect(k('ta')).toBe(te.slice(0, -1) + (te.endsWith('で') ? 'だ' : 'た'));
    expect(k('nakatta')).toBe(nai.slice(0, -2) + 'なかった');
  });

  it('provides romaji for every form', () => {
    for (const id of VERB_FORM_IDS) {
      expect(f[id].romaji).toMatch(/^[a-z']+$/);
    }
  });
});

describe('exceptions', () => {
  it('いく uses いって / いった', () => {
    expect(teForm('いく', 'u')).toBe('いって');
    expect(conjugateVerbForm('いく', 'u', 'ta')).toBe('いった');
    expect(conjugateVerbForm('いく', 'u', 'tekudasai')).toBe('いってください');
    expect(conjugateVerbForm('いく', 'u', 'teimasu')).toBe('いっています');
  });

  it('compounds of いく keep the exception (もっていく)', () => {
    expect(teForm('もっていく', 'u')).toBe('もっていって');
  });

  it('ある has the irregular plain negative ない', () => {
    expect(plainNegative('ある', 'u')).toBe('ない');
    expect(conjugateVerbForm('ある', 'u', 'nakatta')).toBe('なかった');
    expect(conjugateVerbForm('ある', 'u', 'masen')).toBe('ありません');
  });

  it('くる written in kana', () => {
    const f = conjugateVerb('くる', 'irregular');
    expect(f.masu.kana).toBe('きます');
    expect(f.nai.kana).toBe('こない');
    expect(f.te.kana).toBe('きて');
    expect(f.ta.kana).toBe('きた');
    expect(f.nakatta.kana).toBe('こなかった');
    expect(f.mashou.kana).toBe('きましょう');
  });

  it('compounds of くる (もってくる)', () => {
    expect(masuStem('もってくる', 'irregular')).toBe('もってき');
    expect(plainNegative('もってくる', 'irregular')).toBe('もってこない');
  });

  it('suru compounds, also with katakana nouns', () => {
    const f = conjugateVerb('べんきょうする', 'irregular');
    expect(f.masu.kana).toBe('べんきょうします');
    expect(f.ta.kana).toBe('べんきょうした');
    expect(f.nakatta.kana).toBe('べんきょうしなかった');
    expect(conjugateVerbForm('ドライブする', 'irregular', 'mashita')).toBe('ドライブしました');
    expect(conjugateVerbForm('する', 'irregular', 'nakatta')).toBe('しなかった');
  });

  it('ぐ gives いで / いだ, ぬ/ぶ/む give んで / んだ', () => {
    expect(conjugateVerbForm('およぐ', 'u', 'ta')).toBe('およいだ');
    expect(conjugateVerbForm('しぬ', 'u', 'ta')).toBe('しんだ');
    expect(conjugateVerbForm('あそぶ', 'u', 'ta')).toBe('あそんだ');
    expect(conjugateVerbForm('のむ', 'u', 'ta')).toBe('のんだ');
  });

  it('honorific verbs take an い stem', () => {
    expect(conjugateVerbForm('いらっしゃる', 'u', 'masu')).toBe('いらっしゃいます');
    expect(conjugateVerbForm('くださる', 'u', 'masu')).toBe('くださいます');
  });

  it('same spelling, different group gives different forms (きる, いる, かえる)', () => {
    expect(conjugateVerbForm('きる', 'u', 'masu')).toBe('きります');
    expect(conjugateVerbForm('きる', 'ru', 'masu')).toBe('きます');
    expect(conjugateVerbForm('いる', 'u', 'te')).toBe('いって');
    expect(conjugateVerbForm('いる', 'ru', 'te')).toBe('いて');
    expect(conjugateVerbForm('かえる', 'ru', 'masu')).toBe('かえます');
  });

  it('rejects impossible combinations', () => {
    expect(() => conjugateVerb('たべ', 'ru')).toThrow();
    expect(() => conjugateVerb('のむ', 'ru')).toThrow();
    expect(() => conjugateVerb('たべる', 'irregular')).toThrow();
    expect(() => conjugateVerb('たべる', 'u' as VerbGroup)).not.toThrow();
    expect(() => conjugateVerb('たべ', 'u')).toThrow();
    expect(() => conjugateVerb('', 'u')).toThrow();
  });
});

describe('romaji output', () => {
  it('romanizes representative forms', () => {
    expect(conjugateVerb('たべる', 'ru').masu.romaji).toBe('tabemasu');
    expect(conjugateVerb('しぬ', 'u').te.romaji).toBe('shinde');
    expect(conjugateVerb('はなす', 'u').te.romaji).toBe('hanashite');
    expect(conjugateVerb('べんきょうする', 'irregular').mashita.romaji).toBe('benkyoushimashita');
    expect(conjugateVerb('いく', 'u').te.romaji).toBe('itte');
  });
});

describe('FORM_LABELS_ES', () => {
  it('has a Spanish label and explanation for every form', () => {
    for (const id of VERB_FORM_IDS) {
      expect(FORM_LABELS_ES[id].label.length).toBeGreaterThan(2);
      expect(FORM_LABELS_ES[id].explanation.length).toBeGreaterThan(10);
    }
    expect(Object.keys(FORM_LABELS_ES).sort()).toEqual([...VERB_FORM_IDS].sort());
  });
});
