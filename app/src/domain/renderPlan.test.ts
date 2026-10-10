import patternsRaw from '../content/patterns.json';
import { renderKana, renderPlan, type UnlockState } from './renderPlan';

const hira = (chars: string) => new Set([...chars]);
const state = (known = '', kanji: [string, number][] = []): UnlockState => ({
  knownKana: hira(known),
  kanji: new Map(kanji),
});

describe('renderKana', () => {
  it('shows romaji for kana the learner does not know', () => {
    expect(renderKana('たべる', hira(''))).toEqual([{ type: 'romaji', text: 'taberu' }]);
  });

  it('mixes known kana and romaji', () => {
    expect(renderKana('たべる', hira('たる'))).toEqual([
      { type: 'text', text: 'た' },
      { type: 'romaji', text: 'be' },
      { type: 'text', text: 'る' },
    ]);
  });

  it('keeps a romaji run together so combinations convert correctly', () => {
    expect(renderKana('きゃく', hira(''))).toEqual([{ type: 'romaji', text: 'kyaku' }]);
    expect(renderKana('きって', hira(''))).toEqual([{ type: 'romaji', text: 'kitte' }]);
  });

  it('passes non-kana characters through', () => {
    expect(renderKana('あ、1', hira('あ'))).toEqual([{ type: 'text', text: 'あ、1' }]);
  });

  describe('katakana', () => {
    it('falls back to hiragana when katakana is locked but hiragana is known', () => {
      expect(renderKana('テニス', hira('てにす'))).toEqual([{ type: 'text', text: 'てにす' }]);
    });

    it('falls back to romaji when neither script is known', () => {
      expect(renderKana('テニス', hira(''))).toEqual([{ type: 'romaji', text: 'tenisu' }]);
    });

    it('shows real katakana once unlocked', () => {
      expect(renderKana('テニス', hira('テニス'))).toEqual([{ type: 'text', text: 'テニス' }]);
    });

    it('handles the long vowel mark in romaji and in kana', () => {
      expect(renderKana('コーヒー', hira(''))).toEqual([{ type: 'romaji', text: 'koohii' }]);
      expect(renderKana('コーヒー', hira('こひ'))).toEqual([{ type: 'text', text: 'こーひー' }]);
      expect(renderKana('コーヒー', hira('コヒ'))).toEqual([{ type: 'text', text: 'コーヒー' }]);
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
  const text = (segments: ReturnType<typeof renderKana>) => segments.map((s) => (s.type === 'ruby' ? s.base : s.text)).join('');
  const hiragana = 'わたしはをのみません';

  it('shows locked katakana as hiragana (stage 2)', () => {
    const shown = text(renderKana(ja, hira(hiragana + 'こひ')));
    expect(shown).toContain('こーひー');
    expect(shown).not.toContain('コ');
  });

  it('shows the same example in real katakana once those katakana are unlocked (stage 3)', () => {
    const shown = text(renderKana(ja, hira(hiragana + 'こひコヒ')));
    expect(shown).toContain('コーヒー');
  });

  it('falls back to romaji while neither script is known', () => {
    expect(text(renderKana('コーヒー', hira('')))).toBe('koohii');
  });

  it('only the unlocked katakana change script', () => {
    // コ known, ヒ not: コ stays katakana, ヒ falls back to hiragana
    expect(text(renderKana('コーヒー', hira('こひコ')))).toBe('コーひー');
  });
});
