import { content } from '../domain/contentLoader';
import type { GameStats } from '../games/types';
import { useProgress } from '../state/progressStore';
import {
  accuracyOf,
  computePathNodes,
  finishLesson,
  isPassed,
  lessonContent,
  lessonStatus,
  mergeStats,
  nextLesson,
  nextSuggestions,
  roundsFor,
  stageProgress,
  syncKnownKana,
  weakestItems,
  xpEarned,
} from './lessonLogic';

const stats = (correct: number, total: number, items: GameStats['items'] = {}): GameStats => ({ total, correct, bestStreak: 0, items });
const { curriculum } = content;
const lesson = (id: string) => curriculum.find((l) => l.id === id)!;

beforeEach(() => useProgress.getState().resetProgress());

describe('path state against the real curriculum', () => {
  it('starts with only the first lesson available', () => {
    const nodes = computePathNodes(curriculum, []);
    const available = nodes.filter((n) => n.status === 'available').map((n) => n.lesson.id);
    expect(available).toEqual(curriculum.filter((l) => l.requires.length === 0).map((l) => l.id));
    expect(available).toContain('h-a');
    expect(nodes.find((n) => n.lesson.id === 'h-ka')!.status).toBe('locked');
  });

  it('completing a lesson unlocks the ones that require it', () => {
    const nodes = computePathNodes(curriculum, ['h-a']);
    expect(nodes.find((n) => n.lesson.id === 'h-a')!.status).toBe('completed');
    expect(nodes.find((n) => n.lesson.id === 'h-ka')!.status).toBe('available');
    expect(nodes.find((n) => n.lesson.id === 'h-sa')!.status).toBe('locked');
  });

  it('every requires points to an existing lesson', () => {
    const ids = new Set(curriculum.map((l) => l.id));
    for (const l of curriculum) for (const r of l.requires) expect(ids.has(r), `${l.id} -> ${r}`).toBe(true);
  });

  it('marks lessons without any implemented game as coming soon, and still-locked ones as not', () => {
    const none = (): boolean => false;
    const nodes = computePathNodes(curriculum, [], none);
    expect(nodes.every((n) => !n.playable)).toBe(true);
    expect(nodes.find((n) => n.lesson.id === 'h-a')!.comingSoon).toBe(true);
    expect(nodes.find((n) => n.lesson.id === 'h-ka')!.comingSoon).toBe(false);
    // with the real registry every stage 1 lesson is playable
    const real = computePathNodes(curriculum, []);
    expect(real.filter((n) => n.lesson.stage === 1).every((n) => n.playable)).toBe(true);
  });

  it('computes progress per stage and the next lesson', () => {
    const progress = stageProgress(curriculum, ['h-a', 'h-ka']);
    expect(progress.map((p) => p.stage)).toEqual([1, 2, 3, 4]);
    expect(progress[0]).toMatchObject({ stage: 1, done: 2, total: 15 });
    expect(progress.reduce((n, p) => n + p.total, 0)).toBe(curriculum.length);
    expect(nextLesson(computePathNodes(curriculum, ['h-a']))?.id).toBe('h-ka');
  });

  it('interleaves grammar once 2+ kana lessons were completed since the last grammar lesson', () => {
    const done = ['h-a', 'h-ka', 'h-sa', 'h-ta', 'h-na'];
    const nodes = computePathNodes(curriculum, done);
    // l-saludos is open (after h-na) but only the last 2 kana lessons count: h-ta, h-na
    const s = nextSuggestions(nodes, done);
    expect(s.kana?.id).toBe('h-ha');
    expect(s.grammar?.id).toBe('l-saludos');
    expect(s.next?.id).toBe('l-saludos');
    // after the grammar lesson the run restarts: kana first again
    const after = [...done, 'l-saludos'];
    const n2 = computePathNodes(curriculum, after);
    expect(nextSuggestions(n2, after).next?.id).toBe('h-ha');
    // one kana lesson since grammar: still kana
    const one = [...after, 'h-ha'];
    expect(nextSuggestions(computePathNodes(curriculum, one), one).next?.id).toBe('h-ma');
    const two = [...one, 'h-ma'];
    const s2 = nextSuggestions(computePathNodes(curriculum, two), two);
    expect(s2.next?.stage).toBe(2);
    // without completion order the old behaviour (kana first) is kept
    expect(nextLesson(nodes)?.id).toBe('h-ha');
  });

  it('suggests the only available kind', () => {
    expect(nextSuggestions(computePathNodes(curriculum, []), []).grammar).toBeUndefined();
    expect(nextSuggestions(computePathNodes(curriculum, []), []).next?.id).toBe('h-a');
  });

  it('lessonStatus works on a set', () => {
    expect(lessonStatus(lesson('h-ka'), new Set(['h-a']))).toBe('available');
  });
});

describe('completion and unlocking', () => {
  it('passes at 80% accuracy and not below', () => {
    expect(isPassed(stats(8, 10))).toBe(true);
    expect(isPassed(stats(7, 10))).toBe(false);
    expect(isPassed(stats(0, 0))).toBe(false);
    expect(accuracyOf(stats(3, 4))).toBe(0.75);
    expect(xpEarned(stats(7, 10))).toBe(70);
  });

  it('a passed lesson is completed and its kana become known', () => {
    const result = finishLesson(lesson('h-a'), stats(9, 10));
    expect(result.passed).toBe(true);
    const s = useProgress.getState();
    expect(s.completedLessons).toContain('h-a');
    expect(s.knownKana).toEqual(expect.arrayContaining([...'あいうえお']));
  });

  it('a failed lesson changes nothing', () => {
    expect(finishLesson(lesson('h-a'), stats(5, 10)).passed).toBe(false);
    const s = useProgress.getState();
    expect(s.completedLessons).toEqual([]);
    expect(s.knownKana).toEqual([]);
  });

  it('yoon digraphs are unlocked as whole units', () => {
    finishLesson(lesson('h-yoon-1'), stats(10, 10));
    expect(useProgress.getState().knownKana).toContain('きゃ');
  });

  it('syncKnownKana repairs knownKana from completed lessons (e.g. after an import)', () => {
    useProgress.getState().completeLesson('h-a');
    expect(useProgress.getState().knownKana).toEqual([]);
    syncKnownKana(curriculum);
    expect(useProgress.getState().knownKana).toEqual(expect.arrayContaining([...'あいうえお']));
  });
});

describe('summaries', () => {
  it('merges stats and lists the weakest items', () => {
    const a = stats(1, 2, { 'kana:あ': { label: 'あ', correct: 1, wrong: 1 } });
    const b = stats(1, 3, { 'kana:あ': { label: 'あ', correct: 0, wrong: 2 }, 'kana:い': { label: 'い', correct: 1, wrong: 0 } });
    const merged = mergeStats([a, b]);
    expect(merged).toMatchObject({ total: 5, correct: 2 });
    expect(merged.items['kana:あ']).toMatchObject({ correct: 1, wrong: 3 });
    expect(weakestItems(merged).map((w) => w.label)).toEqual(['あ']);
  });

  it('scales rounds between 10 and 15', () => {
    expect(roundsFor(1)).toBe(10);
    expect(roundsFor(5)).toBe(13);
    expect(roundsFor(40)).toBe(15);
  });
});

describe('lesson content from the real data', () => {
  it('every stage 1 lesson has its kana and readable words using only known + new kana', () => {
    const known = new Set<string>();
    for (const l of curriculum.filter((c) => c.stage === 1)) {
      const data = lessonContent(l, known, content);
      expect(data.kana.map((k) => k.char).sort(), l.id).toEqual([...(l.kana ?? [])].sort());
      expect(data.words.length, `${l.id} needs words`).toBeGreaterThan(0);
      for (const k of l.kana ?? []) known.add(k);
    }
  });

  it('kana.json alt survives schema parsing (を accepts wo)', () => {
    expect(content.kana.find((k) => k.char === 'を')?.alt).toContain('wo');
  });
});
