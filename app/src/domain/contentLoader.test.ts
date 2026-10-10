import { loadContent } from './contentLoader';

const word = {
  id: 'neko',
  kana: 'ねこ',
  romaji: 'neko',
  es: ['gato'],
  pos: 'noun',
  lesson: 'G1',
  tags: [],
  source: 'genki',
};

describe('loadContent', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('returns empty data when files are missing', () => {
    const content = loadContent({});
    expect(content.vocab).toEqual([]);
    expect(content.curriculum).toEqual([]);
    expect(content.numbers).toBeUndefined();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('keeps valid entries and warns about invalid ones', () => {
    const content = loadContent({ vocab: [word, { id: 'bad' }] });
    expect(content.vocab).toHaveLength(1);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('vocab.json: 1 entradas inválidas'));
  });

  it('ignores files that are not arrays', () => {
    expect(loadContent({ kanji: { nope: true } }).kanji).toEqual([]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('kanji.json'));
  });

  it('passes numbers.json through untouched', () => {
    expect(loadContent({ numbers: { a: 1 } }).numbers).toEqual({ a: 1 });
  });
});
