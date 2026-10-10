import { content } from '../../domain/contentLoader';
import { createRng } from '../../engine';
import {
  kanjiOf,
  kanjiOptions,
  kanjiWordsFor,
  meaningOptions,
  meaningText,
  readingLabel,
  roundTypeFor,
  sentenceOptions,
  taughtReadings,
  transformSentences,
} from './kanjiLogic';

const kanji = (c: string) => content.kanji.find((k) => k.char === c)!;
const all = new Set(content.kanji.map((k) => k.char));

describe('kanji data helpers', () => {
  it('kanjiOf keeps kanji and drops kana', () => {
    expect(kanjiOf('食べる')).toEqual(['食']);
    expect(kanjiOf('日本語')).toEqual(['日', '本', '語']);
    expect(kanjiOf('ひらがな')).toEqual([]);
  });

  it('shows the readings Genki teaches, on and kun', () => {
    expect(taughtReadings(kanji('食'))).toEqual({ on: ['しょく'], kun: ['た(べる)'] });
    expect(readingLabel(kanji('食'))).toBe('on: しょく · kun: た(べる)');
    expect(taughtReadings(kanji('川')).on).toEqual([]);
  });

  it('every kanji has a Genki reading list inside its readings, strokes and a meaning', () => {
    for (const k of content.kanji) {
      expect(k.strokes, k.char).toBeGreaterThan(0);
      for (const r of k.teach ?? []) expect([...k.on, ...k.kun], `${k.char} ${r}`).toContain(r);
      expect(meaningText(k), k.char).not.toBe('');
    }
    expect(kanji('曜').strokes).toBe(18);
    expect(kanji('一').strokes).toBe(1);
  });
});

describe('meaningOptions / kanjiOptions', () => {
  it('has one right meaning among four different ones', () => {
    for (const k of content.kanji) {
      const options = meaningOptions(k, content.kanji, 4, createRng(7));
      expect(options).toHaveLength(4);
      expect(options.filter((o) => o.correct)).toHaveLength(1);
      expect(new Set(options.map((o) => o.text)).size).toBe(4);
      expect(options.find((o) => o.correct)!.text).toBe(meaningText(k));
    }
  });

  it('offers look-alikes as distractors first', () => {
    const k = kanji('人');
    const options = kanjiOptions(k, content.kanji, 4, createRng(3));
    expect(options).toHaveLength(4);
    expect(options.map((o) => o.char)).toContain('人');
    const similar = options.filter((o) => o.char !== '人' && k.similar?.includes(o.char));
    expect(similar.length).toBe(3);
  });

  it('only uses kanji of the given pool and falls back to the same lesson', () => {
    const pool = content.kanji.filter((k) => k.genkiLesson === 3);
    const options = kanjiOptions(kanji('三'), pool, 4, createRng(1));
    expect(options.every((o) => pool.includes(o))).toBe(true);
    expect(new Set(options.map((o) => o.char)).size).toBe(4);
  });

  it('works with a tiny pool', () => {
    expect(kanjiOptions(kanji('一'), [kanji('一'), kanji('二')])).toHaveLength(2);
  });
});

describe('kanjiWordsFor', () => {
  it('keeps words written with kanji whose kanji are all allowed', () => {
    const words = kanjiWordsFor(content.vocab, new Set(['学', '生']));
    expect(words.map((w) => w.kanji)).toContain('学生');
    expect(words.map((w) => w.kanji)).not.toContain('大学生');
    expect(words.every((w) => kanjiOf(w.kanji!).every((c) => c === '学' || c === '生'))).toBe(true);
  });

  it('requires a practised kanji when given', () => {
    const words = kanjiWordsFor(content.vocab, all, new Set(['食']));
    expect(words.length).toBeGreaterThan(0);
    expect(words.every((w) => w.kanji!.includes('食'))).toBe(true);
  });
});

describe('transformSentences', () => {
  const sentences = transformSentences(content.patterns, content.vocab, all);

  it('turns known stage-2 sentences into sentences with kanji', () => {
    expect(sentences.length).toBeGreaterThan(20);
    const gakusei = transformSentences(content.patterns, content.vocab, all, new Set(['学'])).find((s) => s.tokens.some((t) => t.word?.kanji === '学生'));
    expect(gakusei).toBeDefined();
    expect(gakusei!.tokens.map((t) => t.kana).join(' ')).toContain('がくせい');
  });

  it('only transforms tokens that are the reading of the word, never particles or one-kana tokens', () => {
    for (const s of sentences) {
      for (const t of s.tokens) {
        if (t.word) {
          expect(t.word.kana).toBe(t.kana);
          expect([...t.kana].length).toBeGreaterThanOrEqual(2);
          expect(['は', 'を', 'に', 'で', 'へ', 'も', 'の', 'と', 'が', 'か', 'や', 'から', 'まで']).not.toContain(t.kana);
        }
      }
      expect(s.tokens.some((t) => t.word?.id === s.target.id)).toBe(true);
    }
  });

  it('respects the allowed kanji', () => {
    expect(transformSentences(content.patterns, content.vocab, new Set())).toEqual([]);
    const some = transformSentences(content.patterns, content.vocab, new Set(['私', '学', '生']));
    for (const s of some) for (const t of s.tokens) if (t.word) expect(kanjiOf(t.word.kanji!).every((c) => '私学生'.includes(c))).toBe(true);
  });

  it('builds four different meanings with one right', () => {
    const options = sentenceOptions(sentences[0]!, sentences, 4, createRng(2));
    expect(options).toHaveLength(4);
    expect(options.filter((o) => o.correct).map((o) => o.text)).toEqual([sentences[0]!.es]);
    expect(new Set(options.map((o) => o.text)).size).toBe(4);
  });
});

describe('roundTypeFor', () => {
  const everything = { meaning: true, pick: true, reading: true, transform: true };
  it('cycles meaning, pick, reading, transform', () => {
    expect([0, 1, 2, 3, 4].map((i) => roundTypeFor(i, everything))).toEqual(['meaning', 'pick', 'reading', 'transform', 'meaning']);
  });
  it('skips what is not available', () => {
    expect(roundTypeFor(2, { ...everything, reading: false })).toBe('transform');
    expect(roundTypeFor(2, { meaning: true, pick: false, reading: false, transform: false })).toBe('meaning');
    expect(roundTypeFor(0, { meaning: false, pick: false, reading: false, transform: false })).toBeNull();
  });
});
