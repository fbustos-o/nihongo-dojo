import { content } from '../domain/contentLoader';
import { computePathNodes, shortTitle, unmetRequirements } from './lessonLogic';

const { curriculum } = content;
const HIRA = curriculum.filter((l) => l.stage === 1).map((l) => l.id);
const upTo = (id: string) => HIRA.slice(0, HIRA.indexOf(id) + 1);
const status = (done: string[], id: string) => computePathNodes(curriculum, done).find((n) => n.lesson.id === id)!.status;
const GRAMMAR = curriculum.filter((l) => l.stage === 2);

/** Hiragana index of the last hiragana lesson a lesson needs (directly or through other lessons). */
function hiraGate(id: string, seen = new Map<string, number>()): number {
  if (seen.has(id)) return seen.get(id)!;
  const l = curriculum.find((x) => x.id === id)!;
  const g = Math.max(HIRA.indexOf(id), ...l.requires.map((r) => hiraGate(r, seen)));
  seen.set(id, g);
  return g;
}

describe('grammar is interleaved with hiragana', () => {
  it('l-saludos opens after あ..な only', () => {
    expect(curriculum.find((l) => l.id === 'l-saludos')!.requires).toEqual(['h-na']);
    expect(status(upTo('h-na'), 'l-saludos')).toBe('available');
    expect(status(upTo('h-ta'), 'l-saludos')).toBe('locked');
    expect(status(['h-a'], 'l-saludos')).toBe('locked');
  });

  it('no grammar lesson is gated before h-na', () => {
    const na = HIRA.indexOf('h-na');
    for (const l of GRAMMAR) expect(hiraGate(l.id), l.id).toBeGreaterThanOrEqual(na);
  });

  it('later grammar needs more hiragana, but not all of it', () => {
    expect(hiraGate('l-numeros')).toBeLessThanOrEqual(HIRA.indexOf('h-ma'));
    expect(hiraGate('l-verbos-1')).toBeLessThan(HIRA.indexOf('h-tsu-long'));
    expect(status([...upTo('h-na'), 'l-saludos'], 'l-hora')).toBe('locked');
    expect(status(HIRA, 'l-verbos-1')).toBe('locked'); // still needs the grammar before it
  });

  it('keeps the grammar order of stage 2 (ids unchanged)', () => {
    expect(GRAMMAR.slice(0, 4).map((l) => l.id)).toEqual(['l-saludos', 'l-numeros', 'l-desu', 'l-hora']);
    expect(curriculum.find((l) => l.id === 'l-desu')!.requires).toContain('l-saludos');
    expect(curriculum.find((l) => l.id === 'l-pasado')!.requires).toContain('l-conj-masu');
    expect(GRAMMAR.at(-1)!.id).toBe('l-te-imasu-tai');
  });

  it('a new grammar lesson becomes reachable at least every 3 hiragana lessons', () => {
    const gates = [...new Set(GRAMMAR.map((l) => hiraGate(l.id)))].sort((a, b) => a - b);
    expect(gates[0]).toBe(HIRA.indexOf('h-na'));
    for (let i = 1; i < gates.length; i++) expect(gates[i]! - gates[i - 1]!).toBeLessThanOrEqual(3);
    expect(gates.length).toBeGreaterThanOrEqual(4);
    expect(gates.at(-1)!).toBeLessThan(HIRA.length - 1);
  });

  it('katakana waits for ます verbs and for the end of hiragana', () => {
    expect(status(['l-verbos-1'], 'k-a')).toBe('locked');
    expect(status(HIRA, 'k-a')).toBe('locked');
    expect(status([...HIRA, 'l-verbos-1'], 'k-a')).toBe('available');
  });

  it('the unmet-requirements hint lists titles', () => {
    const l = curriculum.find((x) => x.id === 'l-saludos')!;
    const unmet = unmetRequirements(l, new Set(['h-a']), curriculum);
    expect(unmet.map((u) => u.id)).toEqual(['h-na']);
    expect(shortTitle(unmet[0]!)).toBe('Hiragana fila な');
    expect(unmetRequirements(l, new Set(['h-na']), curriculum)).toEqual([]);
  });
});

describe('stage 5: Kanjikana Core 1000 packages', () => {
  const CORE = curriculum.filter((l) => l.stage === 5);
  const kanjiSet = new Set(content.kanji.map((k) => k.char));
  const isHan = (ch: string) => /[一-鿿]/.test(ch);

  it('has the 40 packages c-01..c-40 with Spanish and English titles', () => {
    expect(CORE.map((l) => l.id)).toEqual(Array.from({ length: 40 }, (_, i) => `c-${String(i + 1).padStart(2, '0')}`));
    expect(CORE[0]!.title).toBe('Vocabulario esencial 1–25');
    expect(CORE[0]!.titleEn).toBe('Essential vocabulary 1–25');
    expect(CORE[39]!.titleEn).toBe('Essential vocabulary 976–1000');
    for (const l of CORE) expect(l.games).toEqual(['flashcards', 'read-words', 'listen', 'kana-write']);
  });

  it('every lesson has an English title', () => {
    for (const l of curriculum) expect(l.titleEn, l.id).toBeTruthy();
  });

  it('packages hold the 25 words of their rank range, all 1000 exactly once', () => {
    const byId = new Map(content.vocab.map((w) => [w.id, w]));
    const ranks: number[] = [];
    CORE.forEach((l, i) => {
      expect(l.words).toHaveLength(25);
      for (const id of l.words ?? []) {
        const r = byId.get(id)!.rank!;
        expect(r, id).toBeGreaterThan(25 * i);
        expect(r, id).toBeLessThanOrEqual(25 * i + 25);
        ranks.push(r);
      }
    });
    expect([...ranks].sort((a, b) => a - b)).toEqual(Array.from({ length: 1000 }, (_, i) => i + 1));
  });

  it('chains: each package requires the previous one and otherwise only hiragana', () => {
    CORE.forEach((l, i) => {
      if (i) expect(l.requires).toContain(CORE[i - 1]!.id);
      for (const r of l.requires) {
        if (i && r === CORE[i - 1]!.id) continue;
        expect(curriculum.find((x) => x.id === r)!.stage, `${l.id} -> ${r}`).toBe(1);
      }
      expect(l.patterns ?? []).toEqual([]);
      expect(l.dialogues ?? []).toEqual([]);
    });
  });

  it('the first package opens early (after a few hiragana rows) and the gate never goes down', () => {
    expect(hiraGate('c-01')).toBeLessThanOrEqual(HIRA.indexOf('h-na'));
    expect(status(upTo('h-na'), 'c-01')).toBe('available');
    expect(status(upTo('h-ta'), 'c-01')).toBe('locked');
    let prev = -1;
    for (const l of CORE) {
      const g = hiraGate(l.id);
      expect(g, l.id).toBeGreaterThanOrEqual(prev);
      prev = g;
    }
    expect(prev).toBeLessThan(HIRA.length - 1); // never needs the whole of hiragana
  });

  it('a package needs no grammar, katakana or kanji lesson, directly or transitively', () => {
    const seen = new Set<string>();
    const walk = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      for (const r of curriculum.find((x) => x.id === id)!.requires) walk(r);
    };
    walk('c-40');
    for (const id of seen) expect([1, 5], id).toContain(curriculum.find((x) => x.id === id)!.stage);
  });

  it('core1000 words never carry kanji outside the Genki set (those live in `written`)', () => {
    const core = content.vocab.filter((w) => w.source === 'core1000');
    expect(core.length).toBeGreaterThan(500);
    for (const w of core) {
      for (const ch of w.kanji ?? '') if (isHan(ch)) expect(kanjiSet.has(ch), `${w.id} ${w.kanji}`).toBe(true);
      expect(w.lesson).toMatch(/^C\d+$/);
      expect(w.en?.length, w.id).toBeGreaterThan(0);
    }
    // the same holds for the Genki words that received a `rank`
    for (const w of content.vocab.filter((x) => x.rank !== undefined))
      for (const ch of w.kanji ?? '') if (isHan(ch)) expect(kanjiSet.has(ch) || ch === '々', `${w.id} ${w.kanji}`).toBe(true);
  });
});
