import { content } from '../domain/contentLoader';
import { conjugableWords, readingFor } from '../games/conjugation/conjugationLogic';

/** QA v2 (Parte 4): invariants of the Kanjikana Core 1000 words merged into vocab.json. */
describe('Core 1000 content', () => {
  const core = content.vocab.filter((w) => w.source === 'core1000');
  const kanjiChars = new Set(content.kanji.map((k) => k.char));
  const HAN = /[一-鿿]/u;

  it('has the 575 new words and 1000 ranks', () => {
    expect(core).toHaveLength(575);
    const ranks = content.vocab.filter((w) => w.rank !== undefined).map((w) => w.rank);
    expect(new Set(ranks).size).toBe(1000);
  });

  it('every verb has a group, and ru verbs end in いる/える (QA-101)', () => {
    for (const w of content.vocab.filter((v) => v.pos === 'verb' && v.source === 'core1000')) {
      expect(w.verbGroup, w.id).toBeDefined();
      if (w.verbGroup === 'ru') expect(w.kana, w.id).toMatch(/[いきぎしじちぢにひびぴみりえけげせぜてでねへべぺめれ]る$/u);
    }
  });

  it('never stores a non-Genki kanji in `kanji` (only in `written`)', () => {
    for (const w of core) {
      for (const ch of w.kanji ?? '') if (HAN.test(ch)) expect(kanjiChars.has(ch), `${w.id} ${ch}`).toBe(true);
    }
  });

  it('な-adjectives take な before a noun: no prenominal like おなじ among them (QA-101)', () => {
    const naAdj = conjugableWords(content.vocab, 'na-adj');
    expect(naAdj.map((w) => w.kana)).not.toContain('おなじ');
    for (const w of naAdj) expect(readingFor(w, 'na-adj', 'attributive').kana).toBe(`${w.kana}な`);
  });

  it('English glosses of verbs are infinitives ("to …") and every Core word has English', () => {
    for (const w of core) {
      expect(w.en?.length, w.id).toBeGreaterThan(0);
      if (w.pos === 'verb') expect(w.en![0], w.id).toMatch(/^(to |can\b)/u);
    }
  });
});
