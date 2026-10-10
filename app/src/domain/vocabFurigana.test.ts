import { content } from './contentLoader';
import { alignFurigana } from './furigana';
import { furiganaParts, renderPlan } from './renderPlan';

const words = content.vocab.filter((w): w is typeof w & { kanji: string } => w.kanji !== undefined);

describe('furigana over the real vocabulary', () => {
  it('has kanji words to check', () => {
    expect(words.length).toBeGreaterThan(300);
  });

  it('every kanji word re-joins to its kana reading', () => {
    const broken = words.filter((w) => {
      const parts = furiganaParts(w);
      const joined = parts.map((p) => (p.type === 'kana' ? p.text : p.reading)).join('');
      const written = parts.map((p) => (p.type === 'kana' ? p.text : p.base)).join('');
      return joined !== w.kana || written !== w.kanji;
    });
    expect(broken.map((w) => `${w.kanji}/${w.kana}`)).toEqual([]);
  });

  it('never leaves a ruby with an empty reading or a kana-only ruby base', () => {
    for (const w of words) {
      for (const p of furiganaParts(w)) {
        if (p.type === 'kanji') {
          expect(p.reading, w.id).not.toBe('');
          expect(/[぀-ヿ]/.test(p.base) && !/[一-鿿々]/.test(p.base), `${w.id} ruby over pure kana`).toBe(false);
        }
      }
    }
  });

  it('falls back to a single block only when the data is inconsistent (none are)', () => {
    const fallback = words.filter((w) => !w.furigana && alignFurigana(w.kanji, w.kana).length === 1 && /[぀-ゟ]/.test(w.kanji) && !/[ぁ-ん]/.test(w.kana));
    expect(fallback).toEqual([]);
  });

  it('shows every kanji word as plain kana until its kanji are unlocked, and bare once all are Guru', () => {
    const all = new Set([...content.kana.flatMap((k) => [...k.char]), ...'ゃゅょっャュョッー']);
    const kanji = new Map<string, number>();
    for (const k of content.kanji) kanji.set(k.char, 5);
    for (const w of words) {
      const locked = renderPlan(w, { knownKana: all, kanji: new Map() });
      expect(locked.every((s) => s.type !== 'ruby'), w.id).toBe(true);
      expect(locked.map((s) => ('text' in s ? s.text : '')).join(''), w.id).toBe(w.kana);
      const guru = renderPlan(w, { knownKana: all, kanji });
      expect(guru.every((s) => s.type === 'text'), w.id).toBe(true);
      expect(guru.map((s) => ('text' in s ? s.text : '')).join(''), w.id).toBe(w.kanji);
    }
  });
});
