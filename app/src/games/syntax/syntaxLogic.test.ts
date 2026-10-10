import { content } from '../../domain/contentLoader';
import { BASE_PARTICLES, buildSolutionTable, buildTiles, examplesOf, isParticle, isValidOrder, syntaxEntries, tokenize } from './syntaxLogic';

const t = (s: string) => tokenize(s);
const pattern = (id: string) => content.patterns.find((p) => p.id === id)!;

describe('tokenize', () => {
  it('drops the final punctuation and splits on spaces', () => {
    expect(t('わたし は みず を のみます。')).toEqual(['わたし', 'は', 'みず', 'を', 'のみます']);
    expect(t('これ は ほん ですか。')).toEqual(['これ', 'は', 'ほん', 'ですか']);
    expect(t('どこ ですか？')).toEqual(['どこ', 'ですか']);
  });
});

describe('isValidOrder', () => {
  const sol = t('きのう わたし は ひるごはん を たべました。');

  it('accepts the exact order', () => {
    expect(isValidOrder(sol, [...sol])).toBe(true);
  });

  it('accepts a movable time phrase (きのう anywhere before the predicate)', () => {
    expect(isValidOrder(sol, t('わたし は きのう ひるごはん を たべました'))).toBe(true);
    expect(isValidOrder(sol, t('わたし は ひるごはん を きのう たべました'))).toBe(true);
    expect(isValidOrder(sol, t('ひるごはん を わたし は きのう たべました'))).toBe(true);
  });

  it('rejects a verb that is not final', () => {
    expect(isValidOrder(sol, t('きのう わたし は たべました ひるごはん を'))).toBe(false);
    expect(isValidOrder(t('わたし は みず を のみます'), t('わたし は のみます みず を'))).toBe(false);
  });

  it('rejects particles detached from their noun', () => {
    expect(isValidOrder(t('わたし は みず を のみます'), t('わたし を みず は のみます'))).toBe(false);
    expect(isValidOrder(sol, t('きのう は わたし ひるごはん を たべました'))).toBe(false);
    expect(isValidOrder(sol, t('は わたし きのう ひるごはん を たべました'))).toBe(false);
  });

  it('rejects missing, extra or wrong pieces', () => {
    expect(isValidOrder(sol, t('わたし は ひるごはん を たべました'))).toBe(false);
    expect(isValidOrder(sol, t('きのう わたし は ひるごはん に たべました'))).toBe(false);
  });

  it('keeps the whole predicate and a final か at the end', () => {
    const s = t('これ は みず じゃ ないです');
    expect(isValidOrder(s, t('これ は みず じゃ ないです'))).toBe(true);
    expect(isValidOrder(s, t('みず じゃ これ は ないです'))).toBe(false);
    const q = t('これ は ほん です か');
    expect(isValidOrder(q, t('これ は ほん です か'))).toBe(true);
    expect(isValidOrder(q, t('か これ は ほん です'))).toBe(false);
    const times = t('じゅうじ から じゅういちじ まで べんきょう します');
    expect(isValidOrder(times, t('じゅういちじ まで じゅうじ から べんきょう します'))).toBe(true);
    expect(isValidOrder(times, t('じゅうじ から じゅういちじ まで します べんきょう'))).toBe(false);
  });

  it('only the exact order is valid when there is no particle', () => {
    expect(isValidOrder(t('ごご よじ です'), t('よじ ごご です'))).toBe(false);
  });
});

describe('buildTiles', () => {
  it('has every token once plus one or two unused particles', () => {
    const tokens = t('わたし は みず を のみます');
    for (let i = 0; i < 20; i++) {
      const tiles = buildTiles(tokens);
      const real = tiles.filter((x) => !x.distractor);
      const extra = tiles.filter((x) => x.distractor);
      expect(real.map((x) => x.text).sort()).toEqual([...tokens].sort());
      expect([1, 2]).toContain(extra.length);
      for (const d of extra) {
        expect(BASE_PARTICLES as readonly string[]).toContain(d.text);
        expect(tokens).not.toContain(d.text);
      }
      expect(new Set(tiles.map((x) => x.id)).size).toBe(tiles.length);
    }
  });
});

describe('buildSolutionTable', () => {
  it('lays out Spanish S-V-O and Japanese S-O-V with the verb highlighted', () => {
    const table = buildSolutionTable(pattern('svo-masu'), t('わたし は みず を のみます'));
    expect(table.spanish.map((c) => c.label)).toEqual(['Sujeto', 'Verbo', 'Objeto']);
    expect(table.spanish.map((c) => c.predicate)).toEqual([false, true, false]);
    expect(table.japanese.map((c) => c.text)).toEqual(['わたし は', 'みず を', 'のみます']);
    expect(table.japanese.map((c) => c.label)).toEqual(['Tema / sujeto', 'Objeto', 'Verbo']);
    expect(table.japanese.map((c) => c.predicate)).toEqual([false, false, true]);
  });
});

describe('content examples', () => {
  it('every pattern example can be built and its particles are recognised', () => {
    const entries = syntaxEntries(content.patterns);
    expect(entries.length).toBeGreaterThan(100);
    for (const e of entries) {
      expect(isValidOrder(e.tokens, e.tokens)).toBe(true);
      expect(e.tokens.every((tok) => tok.length > 0)).toBe(true);
    }
    expect(examplesOf(pattern('svo-masu')).length).toBeGreaterThan(0);
    expect(isParticle('を')).toBe(true);
    expect(isParticle('みず')).toBe(false);
  });
});
