import { alignFurigana } from './furigana';

describe('alignFurigana', () => {
  it('strips trailing okurigana', () => {
    expect(alignFurigana('食べる', 'たべる')).toEqual([
      { type: 'kanji', base: '食', reading: 'た' },
      { type: 'kana', text: 'べる' },
    ]);
  });

  it('strips leading kana', () => {
    expect(alignFurigana('お金', 'おかね')).toEqual([
      { type: 'kana', text: 'お' },
      { type: 'kanji', base: '金', reading: 'かね' },
    ]);
  });

  it('handles prefix and suffix at once', () => {
    expect(alignFurigana('お食べる', 'おたべる')).toEqual([
      { type: 'kana', text: 'お' },
      { type: 'kanji', base: '食', reading: 'た' },
      { type: 'kana', text: 'べる' },
    ]);
  });

  it('keeps a pure-kanji word as one block', () => {
    expect(alignFurigana('学生', 'がくせい')).toEqual([{ type: 'kanji', base: '学生', reading: 'がくせい' }]);
  });

  it('splits around kana embedded between kanji', () => {
    expect(alignFurigana('持ち物', 'もちもの')).toEqual([
      { type: 'kanji', base: '持', reading: 'も' },
      { type: 'kana', text: 'ち' },
      { type: 'kanji', base: '物', reading: 'もの' },
    ]);
  });
});
