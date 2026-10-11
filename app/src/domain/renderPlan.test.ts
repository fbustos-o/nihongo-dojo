import patternsRaw from '../content/patterns.json';
import { renderKana, renderPlan, type UnlockState } from './renderPlan';

const inline = (text: string, known: ReadonlySet<string>) => renderKana(text, known, 'inline');
const hira = (chars: string) => new Set([...chars]);
const state = (known = '', kanji: [string, number][] = [], furigana?: UnlockState['furigana']): UnlockState => ({
  knownKana: hira(known),
  kanji: new Map(kanji),
  furigana,
});

describe('renderKana', () => {
  it('shows romaji for kana the learner does not know', () => {
    expect(inline('たべる', hira(''))).toEqual([{ type: 'romaji', text: 'taberu' }]);
  });

  it('mixes known kana and romaji', () => {
    expect(inline('たべる', hira('たる'))).toEqual([
      { type: 'text', text: 'た' },
      { type: 'romaji', text: 'be' },
      { type: 'text', text: 'る' },
    ]);
  });

  it('keeps a romaji run together so combinations convert correctly', () => {
    expect(inline('きゃく', hira(''))).toEqual([{ type: 'romaji', text: 'kyaku' }]);
    expect(inline('きって', hira(''))).toEqual([{ type: 'romaji', text: 'kitte' }]);
  });

  it('passes non-kana characters through', () => {
    expect(inline('あ、1', hira('あ'))).toEqual([{ type: 'text', text: 'あ、1' }]);
  });


  describe('yoon digraphs', () => {
    const words: [string, string][] = [['きょう', 'kyou'], ['しゃしん', 'shashin'], ['としょかん', 'toshokan'], ['じゅうじ', 'juuji'], ['りょうり', 'ryouri'], ['ひゃく', 'hyaku'], ['ちゃ', 'cha'], ['みょうじ', 'myouji']];
    it.each(words)('%s renders whole when the digraphs are unlocked as units', (w) => {
      const known = new Set([...w].filter((c) => !'ゃゅょ'.includes(c)));
      const units = (w.match(/[^ゃゅょ][ゃゅょ]?/g) ?? []).filter((u) => u.length === 2);
      for (const u of units) known.add(u);
      expect(inline(w, known)).toEqual([{ type: 'text', text: w }]);
    });
    it.each(words)('%s renders whole when base + small kana are unlocked separately', (w) => {
      expect(inline(w, new Set([...w]))).toEqual([{ type: 'text', text: w }]);
    });
    it.each(words)('%s is fully romaji when nothing is known', (w, romaji) => {
      expect(inline(w, hira(''))).toEqual([{ type: 'romaji', text: romaji }]);
    });
    it('never mixes a base kana with the romaji of its small kana', () => {
      expect(inline('きょう', hira('きう'))).toEqual([{ type: 'romaji', text: 'kyo' }, { type: 'text', text: 'う' }]);
      expect(inline('きょう', new Set(['きょ', 'う']))).toEqual([{ type: 'text', text: 'きょう' }]);
    });
    it('katakana digraphs fall back to hiragana digraphs', () => {
      expect(inline('シャツ', new Set(['しゃ', 'つ']))).toEqual([{ type: 'text', text: 'しゃつ' }]);
      expect(inline('シャツ', new Set(['シャ', 'ツ']))).toEqual([{ type: 'text', text: 'シャツ' }]);
      expect(inline('チョコ', hira(''))).toEqual([{ type: 'romaji', text: 'choko' }]);
    });
    it('keeps っ and ー consistent next to digraphs', () => {
      expect(inline('ちょっと', new Set(['ちょ', 'っ', 'と']))).toEqual([{ type: 'text', text: 'ちょっと' }]);
      expect(inline('ジュース', new Set(['ジュ', 'ス']))).toEqual([{ type: 'text', text: 'ジュース' }]);
    });
  });

  describe('katakana', () => {
    it('falls back to hiragana when katakana is locked but hiragana is known', () => {
      expect(inline('テニス', hira('てにす'))).toEqual([{ type: 'text', text: 'てにす' }]);
    });

    it('falls back to romaji when neither script is known', () => {
      expect(inline('テニス', hira(''))).toEqual([{ type: 'romaji', text: 'tenisu' }]);
    });

    it('shows real katakana once unlocked', () => {
      expect(inline('テニス', hira('テニス'))).toEqual([{ type: 'text', text: 'テニス' }]);
    });

    it('handles the long vowel mark in romaji and in kana', () => {
      expect(inline('コーヒー', hira(''))).toEqual([{ type: 'romaji', text: 'koohii' }]);
      expect(inline('コーヒー', hira('こひ'))).toEqual([{ type: 'text', text: 'こーひー' }]);
      expect(inline('コーヒー', hira('コヒ'))).toEqual([{ type: 'text', text: 'コーヒー' }]);
    });
  });
});

describe('renderPlan', () => {
  const taberu = { kana: 'たべる', kanji: '食べる' };

  it('renders plain kana words without kanji', () => {
    expect(renderPlan({ kana: 'ねこ' }, state('ねこ'))).toEqual([{ type: 'text', text: 'ねこ' }]);
  });

  it('shows the kana reading while the kanji is locked', () => {
    expect(renderPlan(taberu, state('たべる'))).toEqual([{ type: 'text', text: 'たべる' }]);
  });

  it('puts furigana only over the kanji of an unlocked word with okurigana', () => {
    expect(renderPlan(taberu, state('たべる', [['食', 1]]))).toEqual([
      { type: 'ruby', base: '食', reading: 'た' },
      { type: 'text', text: 'べる' },
    ]);
  });

  it('renders the furigana itself as romaji when the kana are unknown', () => {
    expect(renderPlan(taberu, state('べる', [['食', 2]]))).toEqual([
      { type: 'ruby', base: '食', reading: 'ta' },
      { type: 'text', text: 'べる' },
    ]);
  });

  it('drops furigana from Guru (stage 5) on', () => {
    expect(renderPlan(taberu, state('たべる', [['食', 4]]))[0]).toMatchObject({ type: 'ruby' });
    expect(renderPlan(taberu, state('たべる', [['食', 5]]))).toEqual([
      { type: 'text', text: '食べる' },
    ]);
  });

  it('needs every kanji of a block unlocked, and mastered, to hide furigana', () => {
    const word = { kana: 'がくせい', kanji: '学生' };
    expect(renderPlan(word, state('がくせい', [['学', 8]]))).toEqual([{ type: 'text', text: 'がくせい' }]);
    expect(renderPlan(word, state('がくせい', [['学', 8], ['生', 3]]))).toEqual([
      { type: 'ruby', base: '学生', reading: 'がくせい' },
    ]);
    expect(renderPlan(word, state('がくせい', [['学', 8], ['生', 6]]))).toEqual([
      { type: 'text', text: '学生' },
    ]);
  });

  it('handles katakana words through the same rule', () => {
    expect(renderPlan({ kana: 'コーヒー' }, state('こひ'))).toEqual([{ type: 'text', text: 'こーひー' }]);
  });
});

describe('stage 2 sentences with katakana loanwords', () => {
  // The example is stored once, with real katakana; JaText decides how to show it.
  const patterns = patternsRaw as { id: string; examples: { ja: string }[] }[];
  const ja = patterns.find((p) => p.id === 'masu-masen')!.examples.find((e) => e.ja.includes('コーヒー'))!.ja;
  const text = (segments: ReturnType<typeof inline>) => segments.map((s) => (s.type === 'ruby' ? s.base : s.type === 'kanaRuby' ? s.kana : s.text)).join('');
  const hiragana = 'わたしはをのみません';

  it('shows locked katakana as hiragana (stage 2)', () => {
    const shown = text(inline(ja, hira(hiragana + 'こひ')));
    expect(shown).toContain('こーひー');
    expect(shown).not.toContain('コ');
  });

  it('shows the same example in real katakana once those katakana are unlocked (stage 3)', () => {
    const shown = text(inline(ja, hira(hiragana + 'こひコヒ')));
    expect(shown).toContain('コーヒー');
  });

  it('falls back to romaji while neither script is known', () => {
    expect(text(inline('コーヒー', hira('')))).toBe('koohii');
  });

  it('only the unlocked katakana change script', () => {
    // コ known, ヒ not: コ stays katakana, ヒ falls back to hiragana
    expect(text(inline('コーヒー', hira('こひコ')))).toBe('コーひー');
  });
});

describe('renderPlan furigana setting', () => {
  const taberu = { kana: 'たべる', kanji: '食べる' };
  const ruby = [
    { type: 'ruby', base: '食', reading: 'た' },
    { type: 'text', text: 'べる' },
  ];
  const bare = [{ type: 'text', text: '食べる' }];

  it('auto (default) follows the SRS rule', () => {
    expect(renderPlan(taberu, state('たべる', [['食', 4]], 'auto'))).toEqual(ruby);
    expect(renderPlan(taberu, state('たべる', [['食', 5]], 'auto'))).toEqual(bare);
    expect(renderPlan(taberu, state('たべる', [['食', 5]]))).toEqual(bare);
  });

  it('siempre keeps the furigana even for mastered kanji', () => {
    expect(renderPlan(taberu, state('たべる', [['食', 9]], 'siempre'))).toEqual(ruby);
    expect(renderPlan(taberu, state('たべる', [['食', 1]], 'siempre'))).toEqual(ruby);
  });

  it('nunca shows unlocked kanji bare from the start', () => {
    expect(renderPlan(taberu, state('たべる', [['食', 1]], 'nunca'))).toEqual(bare);
    expect(renderPlan(taberu, state('たべる', [['食', 0]], 'nunca'))).toEqual(bare);
  });

  it('never unlocks kanji by itself: locked kanji stay as kana in every mode', () => {
    for (const mode of ['auto', 'siempre', 'nunca'] as const) {
      expect(renderPlan(taberu, state('たべる', [], mode))).toEqual([{ type: 'text', text: 'たべる' }]);
    }
  });

  it('uses the explicit furigana of a word, with one ruby over irregular jukugo', () => {
    const kyou = { kana: 'きょう', kanji: '今日', furigana: [['今日', 'きょう']] as const };
    expect(renderPlan(kyou, state('きょう', [['今', 1], ['日', 1]]))).toEqual([{ type: 'ruby', base: '今日', reading: 'きょう' }]);
    // one locked kanji hides the whole ruby block
    expect(renderPlan(kyou, state('きょう', [['今', 1]]))).toEqual([{ type: 'text', text: 'きょう' }]);
    const gakusei = { kana: 'がくせい', kanji: '学生', furigana: [['学', 'がく'], ['生', 'せい']] as const };
    expect(renderPlan(gakusei, state('がくせい', [['学', 1]]))).toEqual([{ type: 'ruby', base: '学', reading: 'がく' }, { type: 'text', text: 'せい' }]);
  });

  it('treats 々 as part of the previous kanji', () => {
    const tokidoki = { kana: 'ときどき', kanji: '時々' };
    expect(renderPlan(tokidoki, state('ときどき', [['時', 1]]))).toEqual([{ type: 'ruby', base: '時々', reading: 'ときどき' }]);
    expect(renderPlan(tokidoki, state('ときどき', [['時', 5]]))).toEqual([{ type: 'text', text: '時々' }]);
  });
});

describe('QA-038: a locked っ is never dropped (inline)', () => {
  const all = (skip: string) => new Set([...'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ'].filter((c) => !skip.includes(c)));
  const shown = (w: string, known: ReadonlySet<string>) => inline(w, known).map((s) => (s.type === 'kanaRuby' ? s.kana : s.type === 'ruby' ? s.base : s.text)).join('');
  it('doubles the next consonant: みっつ -> mittsu', () => {
    expect(inline('みっつ', hira(''))).toEqual([{ type: 'romaji', text: 'mittsu' }]);
    expect(shown('みっつ', all('っ'))).toBe('みttsu');
  });
  it('pulls the next known kana into the romaji run: がっこう -> gakkou, まって -> matte', () => {
    expect(shown('がっこう', all('っ'))).toBe('がkkoう');
    expect(shown('まって', all('っ'))).toBe('まtte');
    expect(shown('ちょっと', all('っ').add('ちょ'))).toBe('ちょtto');
  });
  it('spells a っ that has nothing to double (end of word, before a vowel)', () => {
    expect(inline('あっ', hira(''))).toEqual([{ type: 'romaji', text: 'axtsu' }]);
    expect(shown('あっ', all('っ'))).toBe('あxtsu'.replace('あ', 'あ'));
  });
  it('handles katakana ッ', () => {
    expect(inline('ホッチキス', hira(''))).toEqual([{ type: 'romaji', text: 'hotchikisu' }]);
    expect(shown('サッカー', hira('かー'))).toBe('sakkaa');
  });
  it('keeps っ when known', () => {
    expect(inline('がっこう', new Set([...'がっこう']))).toEqual([{ type: 'text', text: 'がっこう' }]);
  });
});

describe('QA-036: unknown kana are kana with romaji ruby (default mode)', () => {
  it('おはよう with は unknown -> plain kana + ruby over は', () => {
    expect(renderKana('おはよう', hira('およう'))).toEqual([
      { type: 'text', text: 'お' },
      { type: 'kanaRuby', kana: 'は', romaji: 'ha' },
      { type: 'text', text: 'よう' },
    ]);
  });
  it('fully known text has no ruby, nothing known has ruby on every unit', () => {
    expect(renderKana('ねこ', hira('ねこ'))).toEqual([{ type: 'text', text: 'ねこ' }]);
    expect(renderKana('ねこ', hira(''))).toEqual([
      { type: 'kanaRuby', kana: 'ね', romaji: 'ne' },
      { type: 'kanaRuby', kana: 'こ', romaji: 'ko' },
    ]);
  });
  it('yoon units stay intact', () => {
    expect(renderKana('きょう', hira('う'))).toEqual([
      { type: 'kanaRuby', kana: 'きょ', romaji: 'kyo' },
      { type: 'text', text: 'う' },
    ]);
    expect(renderKana('きょう', new Set(['きょ', 'う']))).toEqual([{ type: 'text', text: 'きょう' }]);
  });
  it('っ shows the doubled consonant of the next unit over itself', () => {
    expect(renderKana('みっつ', hira('みつ'))).toEqual([
      { type: 'text', text: 'み' },
      { type: 'kanaRuby', kana: 'っ', romaji: 't' },
      { type: 'text', text: 'つ' },
    ]);
    expect(renderKana('まって', hira('まて'))).toContainEqual({ type: 'kanaRuby', kana: 'っ', romaji: 't' });
    expect(renderKana('あっ', hira('あ'))).toContainEqual({ type: 'kanaRuby', kana: 'っ', romaji: 'xtsu' });
    expect(renderKana('ホッチ', hira(''))).toContainEqual({ type: 'kanaRuby', kana: 'っ', romaji: 't' });
  });
  it('ー stays a plain mark; spaces and punctuation pass through', () => {
    expect(renderKana('コーヒー', hira('こ'))).toEqual([
      { type: 'text', text: 'こー' },
      { type: 'kanaRuby', kana: 'ひ', romaji: 'hi' },
      { type: 'text', text: 'ー' },
    ]);
    expect(renderKana('しちじ じゅうごふん、', hira('しちゅうごふ'))).toContainEqual({ type: 'kanaRuby', kana: 'じ', romaji: 'ji' });
  });
  it('katakana falls back to hiragana, and to hiragana + ruby when that is unknown too', () => {
    expect(renderKana('テニス', hira('てにす'))).toEqual([{ type: 'text', text: 'てにす' }]);
    expect(renderKana('テニス', hira('て'))).toEqual([
      { type: 'text', text: 'て' },
      { type: 'kanaRuby', kana: 'に', romaji: 'ni' },
      { type: 'kanaRuby', kana: 'す', romaji: 'su' },
    ]);
  });
  it('locked kanji fall back to their reading, with the same ruby rule', () => {
    expect(renderPlan({ kana: 'たべる', kanji: '食べる' }, state('べる'))).toEqual([
      { type: 'kanaRuby', kana: 'た', romaji: 'ta' },
      { type: 'text', text: 'べる' },
    ]);
  });
  it("'inline' keeps the old mixed romaji", () => {
    expect(renderPlan({ kana: 'たべる' }, state('る'), 'inline')).toEqual([{ type: 'romaji', text: 'tabe' }, { type: 'text', text: 'る' }]);
  });
});
