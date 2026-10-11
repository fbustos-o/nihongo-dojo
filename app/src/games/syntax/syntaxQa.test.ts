import { content } from '../../domain/contentLoader';
import { buildSolutionTable, buildTiles, isValidOrder, syntaxEntries, tokenize, tokenizeWithPunctuation } from './syntaxLogic';

const t = (s: string) => tokenize(s);

describe('QA-010: N の N and N や N move as one noun phrase', () => {
  const desk = t('つくえ の うえ に ほん が あります。');
  it('accepts moving the whole phrase', () => {
    expect(isValidOrder(desk, t('ほん が つくえ の うえ に あります'))).toBe(true);
  });
  it('rejects separating the modifier from its noun', () => {
    expect(isValidOrder(desk, t('うえ に つくえ の ほん が あります'))).toBe(false);
    expect(isValidOrder(desk, t('つくえ の ほん が うえ に あります'))).toBe(false);
  });
  it('rejects a modifier moved away in a の chain with a topic', () => {
    const sol = t('これ は だれ の かばん ですか。');
    expect(isValidOrder(sol, t('だれ の これ は かばん ですか'))).toBe(false);
    expect(isValidOrder(sol, [...sol])).toBe(true);
  });
  it('N や N stays together', () => {
    const sol = t('ともだち と ほん や ざっし を かいました。');
    expect(isValidOrder(sol, t('ほん や ざっし を ともだち と かいました'))).toBe(true);
    expect(isValidOrder(sol, t('ざっし を ともだち と ほん や かいました'))).toBe(false);
    expect(isValidOrder(sol, t('ほん ともだち と や ざっし を かいました'))).toBe(false);
  });
  it('わたし の ともだち は … moves as a unit', () => {
    const sol = t('きのう わたし の ともだち は ほん を よみました。');
    expect(isValidOrder(sol, t('わたし の ともだち は きのう ほん を よみました'))).toBe(true);
    expect(isValidOrder(sol, t('ともだち は わたし の きのう ほん を よみました'))).toBe(false);
  });
  it('the solution table keeps the phrase in one cell labelled by its last particle', () => {
    const table = buildSolutionTable(undefined, t('つくえ の うえ に ほん が あります'));
    expect(table.japanese.map((c) => c.text)).toEqual(['つくえ の うえ に', 'ほん が', 'あります']);
    expect(table.japanese[0]!.label).toBe('Dirección / tiempo / lugar');
  });
});

describe('QA-024: 「、」 and 「。」 are punctuation, not tiles', () => {
  it('splits glued punctuation (old content) and spaced punctuation (new content) the same way', () => {
    expect(t('はい、がくせい です。')).toEqual(['はい', 'がくせい', 'です']);
    expect(t('はい 、 がくせい です。')).toEqual(['はい', 'がくせい', 'です']);
    expect(t('カレーライス、ふたつ、おねがいします。')).toEqual(['カレーライス', 'ふたつ', 'おねがいします']);
    expect(t('あつい から、みず が ほしい。')).toEqual(['あつい', 'から', 'みず', 'が', 'ほしい']);
  });
  it('tokenizeWithPunctuation keeps 、 as its own token for the solution', () => {
    expect(tokenizeWithPunctuation('はい、がくせい です。')).toEqual(['はい', '、', 'がくせい', 'です']);
    expect(tokenizeWithPunctuation('はい 、 がくせい です。')).toEqual(['はい', '、', 'がくせい', 'です']);
  });
  it('no tile is punctuation or has punctuation inside it', () => {
    for (const entry of syntaxEntries(content.patterns)) {
      for (const token of entry.tokens) expect(token).not.toMatch(/[、，。]/u);
      expect(buildTiles(entry.tokens).every((tile) => !/[、，。]/u.test(tile.text))).toBe(true);
    }
  });
  it('the punctuation shows up in the solution table', () => {
    const table = buildSolutionTable(undefined, tokenizeWithPunctuation('はい、がくせい です。'));
    expect(table.japanese.map((c) => c.text).join(' ')).toBe('はい、 がくせい です');
  });
  it('a sentence with a comma is solved by the words alone', () => {
    expect(isValidOrder(t('はい、がくせい です。'), ['はい', 'がくせい', 'です'])).toBe(true);
  });
});

describe('QA-034: the Spanish structure row only appears when it fits the sentence', () => {
  it('is hidden for a short answer', () => {
    const p = content.patterns.find((x) => x.english.length === 3)!;
    expect(buildSolutionTable(p, t('はい、がくせい です')).spanish).toEqual([]);
  });
  it('is shown when the slots match the parts of the sentence', () => {
    const p = content.patterns.find((x) => x.english.map((s) => s.slot).join() === 'S,V,O')!;
    const table = buildSolutionTable(p, t('わたし は すし を たべます'));
    expect(table.spanish.map((s) => s.label)).toEqual(['Sujeto', 'Verbo', 'Objeto']);
  });
});
