import type { Lesson } from '../domain/schema';
import { dueTimeFor } from '../engine/srs';
import { bumpDaily, emptyDaily } from './daily';
import { planToday, selectNewWords } from './dailyPlan';
import { itemKey, type ItemState } from './progressSchema';
import { useProgress } from './progressStore';
import { word } from './testWords';

const NOW = new Date(2026, 10, 6, 12).getTime();
const item = (id: string, patch: Partial<ItemState> = {}): [string, ItemState] => [
  itemKey('word', id),
  { itemId: id, kind: 'word', srsStage: 1, correct: 1, wrong: 0, lastSeen: NOW - 10 * 3_600_000, nextDue: NOW - 1000, weight: 1, ...patch },
];
const lesson = { id: 'c-01', title: 'Vocabulario 1' } as Lesson;

describe('planToday', () => {
  it('prioritises due reviews', () => {
    const plan = planToday({ items: Object.fromEntries([item('a')]), now: NOW, newWordsPerDay: 10, newWordsDone: 3, nextLesson: lesson });
    expect(plan).toMatchObject({ reviewsDue: 1, newWordsTarget: 10, newWordsDone: 3, newWordsLeft: 7, primary: 'review' });
  });
  it('then pending new words, then the next lesson, then nothing', () => {
    expect(planToday({ items: {}, now: NOW, newWordsPerDay: 10, newWordsDone: 0, nextLesson: lesson }).primary).toBe('learn');
    expect(planToday({ items: {}, now: NOW, newWordsPerDay: 10, newWordsDone: 10, nextLesson: lesson })).toMatchObject({ newWordsLeft: 0, primary: 'lesson', nextLesson: lesson });
    expect(planToday({ items: {}, now: NOW, newWordsPerDay: 10, newWordsDone: 12 }).newWordsLeft).toBe(0);
    expect(planToday({ items: {}, now: NOW, newWordsPerDay: 10, newWordsDone: 10 }).primary).toBe('none');
  });
  it('does not count not-yet-due or burned items, and caps new words by what is available', () => {
    const items = Object.fromEntries([item('a', { nextDue: NOW + 1000 }), item('b', { srsStage: 9, nextDue: NOW - 1 })]);
    const plan = planToday({ items, now: NOW, newWordsPerDay: 10, newWordsDone: 0, newWordsAvailable: 4 });
    expect(plan).toMatchObject({ reviewsDue: 0, newWordsLeft: 4, primary: 'learn' });
    expect(planToday({ items: {}, now: NOW, newWordsPerDay: 0, newWordsDone: 0 }).newWordsLeft).toBe(0);
  });
});

describe('selectNewWords', () => {
  const vocab = [
    word('c', 'ねこ', 3),
    word('a', 'いぬ', 1),
    word('b', 'さかな', 2),
    word('k', 'カメ', 4),
    word('plain', 'いぬ'), // no rank: not a Core word
    word('x', '犬', 5), // kanji reading: never readable
  ];
  const known = new Set(['い', 'ぬ', 'ね', 'こ', 'さ', 'か', 'な']);
  it('returns Core words readable with the known kana, in rank order', () => {
    expect(selectNewWords(vocab, {}, known).map((w) => w.id)).toEqual(['a', 'b', 'c']);
    expect(selectNewWords(vocab, {}, known, 2).map((w) => w.id)).toEqual(['a', 'b']);
  });
  it('skips kana still locked (katakana needs katakana)', () => {
    expect(selectNewWords(vocab, {}, new Set([...known, 'カ', 'メ'])).map((w) => w.id)).toEqual(['a', 'b', 'c', 'k']);
    expect(selectNewWords(vocab, {}, new Set(['い'])).map((w) => w.id)).toEqual([]);
  });
  it('skips words already started or known; stage 0 still counts as new', () => {
    const items = { [itemKey('word', 'a')]: { srsStage: 1 }, [itemKey('word', 'b')]: { srsStage: 0 } };
    expect(selectNewWords(vocab, items, known).map((w) => w.id)).toEqual(['b', 'c']);
  });
});

describe('daily.newWords', () => {
  it('bumpDaily accumulates newWords', () => {
    const d1 = bumpDaily({}, new Date(2026, 10, 6), { newWords: 2 });
    const d2 = bumpDaily(d1, new Date(2026, 10, 6), { newWords: 1, lessons: 1 });
    expect(Object.values(d2)[0]).toEqual({ ...emptyDaily(), newWords: 3, lessons: 1 });
  });
});

describe('markKnown / unmarkKnown', () => {
  beforeEach(() => useProgress.getState().resetProgress());
  it('puts the item at Guru 1 with a coherent nextDue, without XP, streak or daily', () => {
    const before = Date.now();
    useProgress.getState().markKnown('word', 'neko', 'ねこ');
    const s = useProgress.getState();
    const it = s.items[itemKey('word', 'neko')]!;
    expect(it.srsStage).toBe(5);
    expect(it.nextDue).toBeGreaterThanOrEqual(dueTimeFor(5, before));
    expect(it.nextDue).toBeLessThanOrEqual(dueTimeFor(5, Date.now()));
    expect(s.xp).toBe(0);
    expect(s.streak.count).toBe(0);
    expect(s.daily).toEqual({});
  });
  it('keeps higher stages; unmark returns to 0 (not due) and ignores unknown items', () => {
    const { markKnown, unmarkKnown } = useProgress.getState();
    markKnown('word', 'neko');
    unmarkKnown('word', 'neko');
    expect(useProgress.getState().items[itemKey('word', 'neko')]).toMatchObject({ srsStage: 0, nextDue: 0, lastSeen: 0 });
    useProgress.setState({ items: { [itemKey('word', 'inu')]: { itemId: 'inu', kind: 'word', srsStage: 7, correct: 0, wrong: 0, lastSeen: 1, nextDue: 5, weight: 1 } } });
    markKnown('word', 'inu');
    expect(useProgress.getState().items[itemKey('word', 'inu')]!.srsStage).toBe(7);
    unmarkKnown('word', 'nadie');
    expect(useProgress.getState().items[itemKey('word', 'nadie')]).toBeUndefined();
  });
  it('countNewWord bumps today', () => {
    useProgress.getState().countNewWord();
    useProgress.getState().countNewWord();
    expect(Object.values(useProgress.getState().daily)[0]!.newWords).toBe(2);
  });
});
