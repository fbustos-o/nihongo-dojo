import { content } from '../domain/contentLoader';
import { isReadableWith } from '../engine';
import { computePathNodes, lessonContent } from './lessonLogic';

const { curriculum, vocab } = content;
const byId = new Map(vocab.map((w) => [w.id, w]));
const lesson = (id: string) => curriculum.find((l) => l.id === id)!;
const stage = (n: number) => curriculum.filter((l) => l.stage === n);
const hiraganaAll = new Set(stage(1).flatMap((l) => l.kana ?? []));
const kataLessons = stage(3).filter((l) => l.kana);
const loanLessons = stage(3).filter((l) => !l.kana && l.id.startsWith('k-prestamos'));

describe('stage 3 gating', () => {
  it('k-a needs only the lesson that introduces ます verbs, not the whole of stage 2', () => {
    expect(lesson('k-a').requires).toEqual(['l-verbos-1']);
    expect(lesson('l-verbos-1').title).toMatch(/Verbos ます/);
    expect(lesson('k-a').requires).not.toContain(stage(2).at(-1)!.id);
  });

  it('katakana and the rest of stage 2 progress in parallel', () => {
    const done = ['h-a'];
    const ancestors = (id: string, seen = new Set<string>()): Set<string> => {
      for (const r of lesson(id).requires) if (!seen.has(r)) ancestors(r, seen.add(r));
      return seen;
    };
    const needed = [...ancestors('k-a'), 'k-a'];
    const nodes = computePathNodes(curriculum, [...needed, ...done]);
    expect(nodes.find((n) => n.lesson.id === 'k-ka')!.status).toBe('available');
    // a later stage 2 lesson is still available too
    expect(nodes.find((n) => n.lesson.id === 'l-conj-masu')!.status).not.toBe('completed');
    expect(needed).not.toContain('l-conj-masu');
    expect(needed).not.toContain('l-te-imasu-tai');
  });

  it('loanword lessons depend on a related stage 2 topic', () => {
    expect(lesson('k-prestamos-comida').requires).toContain('l-particulas');
    expect(lesson('k-prestamos-lugares').requires).toContain('l-aru-iru');
    expect(lesson('k-prestamos-cosas').requires).toContain('l-kore');
    expect(lesson('k-prestamos-ocio').requires).toContain('l-invitar');
    expect(lesson('k-repaso').requires).toEqual(expect.arrayContaining(['l-restaurante', 'l-adjetivos-na']));
  });

  it('kanji still comes after all of stage 2 and the katakana review', () => {
    expect(lesson('kanji-3').requires).toEqual(expect.arrayContaining(['k-repaso', stage(2).at(-1)!.id]));
  });

  it('the requires graph is acyclic and only points to existing lessons', () => {
    const ids = new Set(curriculum.map((l) => l.id));
    const state = new Map<string, number>();
    const visit = (id: string) => {
      expect(state.get(id)).not.toBe(1);
      if (state.get(id) === 2) return;
      state.set(id, 1);
      for (const r of lesson(id).requires) {
        expect(ids.has(r)).toBe(true);
        visit(r);
      }
      state.set(id, 2);
    };
    curriculum.forEach((l) => visit(l.id));
  });
});

describe('stage 3 content audit', () => {
  it('teaches ー in the first katakana lesson, with words that use it', () => {
    const first = kataLessons[0]!;
    expect(first.id).toBe('k-a');
    expect(first.kana).toContain('ー');
    expect(first.words!.some((id) => byId.get(id)!.kana.includes('ー'))).toBe(true);
  });

  it('every katakana lesson only uses katakana known up to that lesson (ー and ッ included)', () => {
    const known = new Set<string>(hiraganaAll);
    for (const l of kataLessons) {
      (l.kana ?? []).forEach((k) => known.add(k));
      for (const id of l.words ?? []) {
        const w = byId.get(id)!;
        expect(isReadableWith(w.kana, known), `${l.id}: ${w.kana}`).toBe(true);
      }
    }
  });

  it('ッ words come only after ッ is taught', () => {
    const idx = kataLessons.findIndex((l) => l.kana!.includes('ッ'));
    expect(idx).toBeGreaterThan(0);
    kataLessons.slice(0, idx).forEach((l) => l.words!.forEach((id) => expect(byId.get(id)!.kana).not.toContain('ッ')));
  });

  it('loanword lessons are readable with hiragana + all katakana (mixed scripts allowed)', () => {
    const known = new Set([...hiraganaAll, ...kataLessons.flatMap((l) => l.kana!)]);
    expect(loanLessons.length).toBeGreaterThanOrEqual(4);
    for (const l of loanLessons) {
      expect(l.words!.length).toBeGreaterThan(5);
      for (const id of l.words!) expect(isReadableWith(byId.get(id)!.kana, known), `${l.id}: ${id}`).toBe(true);
    }
    const mixed = loanLessons.flatMap((l) => l.words!).filter((id) => /[ぁ-ゖ]/.test(byId.get(id)!.kana) && /[ァ-ヺ]/.test(byId.get(id)!.kana));
    expect(mixed.length).toBeGreaterThan(3);
  });

  it('the extended-kana lesson has plenty of words and covers each extended kana', () => {
    const ext = lesson('k-extended');
    const kana = ext.words!.map((id) => byId.get(id)!.kana);
    expect(kana.length).toBeGreaterThanOrEqual(12);
    for (const must of ['パーティー', 'フォーク', 'チェック', 'シェフ', 'ウィーン']) expect(kana).toContain(must);
    const text = kana.join('');
    for (const unit of ['ウィ', 'ウェ', 'ウォ', 'ジェ', 'シェ', 'チェ', 'ティ', 'ディ', 'デュ', 'ファ', 'フィ', 'フェ', 'フォ', 'ヴァ']) expect(text).toContain(unit);
    expect(ext.kana).toContain('ヴ');
  });

  it('new words have a Spanish meaning, tags and source propio', () => {
    for (const id of ['shefu', 'wiin', 'weitaa', 'webu', 'wootaa', 'ferii', 'fakkusu', 'fan', 'cheen', 'dinaa', 'jettokoosutaa', 'finrando', 'dyuetto', 'aa-katakana', 'oo-katakana', 'tenisu-wo-suru']) {
      const w = byId.get(id)!;
      expect(w, id).toBeDefined();
      expect(w.es.length).toBeGreaterThan(0);
      expect(w.tags.length).toBeGreaterThan(0);
      expect(w.source).toBe('propio');
    }
  });

  it('origin is optional and filled for the obvious loanwords', () => {
    expect(byId.get('terebi')!.origin).toMatch(/television/);
    expect(byId.get('pan')!.origin).toMatch(/portugués.*pão/);
    expect(byId.get('arubaito')!.origin).toMatch(/alemán.*Arbeit/);
    expect(byId.get('taberu')!.origin).toBeUndefined();
  });
});

describe('lessonContent in stage 3', () => {
  const known = (l: ReturnType<typeof lesson>) => {
    const before = new Set<string>(hiraganaAll);
    for (const k of kataLessons) {
      if (k.id === l.id) break;
      k.kana!.forEach((c) => before.add(c));
    }
    return before;
  };

  it('offers only katakana words readable with known + lesson katakana, never plain hiragana words', () => {
    for (const l of stage(3)) {
      const k = known(l);
      const data = lessonContent(l, k);
      const all = new Set([...k, ...(l.kana ?? [])]);
      for (const w of data.words) {
        expect(w.kana).toMatch(/[ァ-ヺ]/);
        expect(isReadableWith(w.kana, all), `${l.id}: ${w.kana}`).toBe(true);
      }
    }
  });

  it('k-ta gets its own katakana words and those of earlier lessons, not katakana it has not met', () => {
    const l = lesson('k-ta');
    const data = lessonContent(l, known(l));
    const kana = data.words.map((w) => w.kana);
    expect(kana).toEqual(expect.arrayContaining(l.words!.map((id) => byId.get(id)!.kana)));
    expect(kana.every((k) => !/[ナニヌネノハヒフヘホ]/.test(k))).toBe(true);
  });

  it('keeps mixed-script words in loanword lessons', () => {
    const l = lesson('k-prestamos-ocio');
    const k = new Set([...hiraganaAll, ...kataLessons.flatMap((x) => x.kana!)]);
    const words = lessonContent(l, k).words.map((w) => w.kana);
    expect(words).toContain('テニスをする');
  });
});
