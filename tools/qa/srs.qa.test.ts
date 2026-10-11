/**
 * QA E8/Q1 — SRS / progress correctness. Run with TZ=America/Santiago (npm run test:qa sets it).
 * `it.fails` = documents a real bug.
 */
import { applyAnswer, dueItems, dueTimeFor, nextStage, NEVER_DUE, reviewQueue, STAGE_INTERVAL_MS } from '../../app/src/engine/srs';
import { levelFromXp, xpForLevel } from '../../app/src/engine/levels';
import { localDateString, touchStreak } from '../../app/src/state/streak';
import { bumpDaily, lastSevenDays } from '../../app/src/state/daily';
import { parseProgress, loadProgress, saveProgress } from '../../app/src/state/persistence';
import { createInitialProgress, STORAGE_KEY, type ItemState } from '../../app/src/state/progressSchema';
import { useProgress } from '../../app/src/state/progressStore';
import { batchProps, planReview } from '../../app/src/review/reviewLogic';
import { content } from '../../app/src/domain/contentLoader';
import { makeNumberQuestion } from '../../app/src/games/numbers/numbersLogic';
import { kanjiToCredit } from '../../app/src/games/kanji/kanjiLogic';

const H = 3_600_000;
const D = 24 * H;
const item = (over: Partial<ItemState> = {}): ItemState => ({ itemId: 'あ', kind: 'kana', srsStage: 0, correct: 0, wrong: 0, lastSeen: 0, nextDue: 0, weight: 1, ...over });

describe('SRS engine', () => {
  it('intervals 4h 8h 1d 2d 1w 2w 1mo 4mo, then burned', () => {
    expect(STAGE_INTERVAL_MS).toEqual([0, 4 * H, 8 * H, D, 2 * D, 7 * D, 14 * D, 30 * D, 120 * D, null]);
    expect(dueTimeFor(9, 0)).toBe(NEVER_DUE);
  });
  it('stage changes: +1 right, penalties wrong (x2 from Guru), floor 1, new stays 0', () => {
    expect(nextStage(0, true)).toBe(1);
    expect(nextStage(0, false)).toBe(0);
    expect(nextStage(1, false)).toBe(1);
    expect(nextStage(4, false)).toBe(3);
    expect(nextStage(6, false)).toBe(4);
    expect(nextStage(8, false, 3)).toBe(4);
    expect(nextStage(9, true)).toBe(9);
  });
  it('burned items are never due; unseen items are never due', () => {
    const now = 1e12;
    expect(dueItems([item({ srsStage: 9, lastSeen: 1, nextDue: 0 }), item({ itemId: 'い', lastSeen: 0, nextDue: 0 })], now)).toEqual([]);
  });
  it('applyAnswer after a wrong first answer: due again immediately', () => {
    const a = applyAnswer(item(), false, 1000);
    expect(a.srsStage).toBe(0);
    expect(a.nextDue).toBe(1000);
  });
  it('review queue: most overdue first, limited', () => {
    const now = 10 * D;
    const q = reviewQueue([item({ itemId: 'b', lastSeen: 1, nextDue: 5 * D }), item({ itemId: 'a', lastSeen: 1, nextDue: 2 * D })], now, { limit: 1 });
    expect(q.map((i) => i.itemId)).toEqual(['a']);
  });
});

describe('progress store', () => {
  beforeEach(() => useProgress.setState(createInitialProgress()));

  it.fails('QA-002: answering an item that is not due does not climb the SRS (9 right answers in a row burn it)', () => {
    for (let i = 0; i < 9; i++) useProgress.getState().recordAnswer('あ', 'kana', true);
    const st = useProgress.getState().items['kana:あ']!;
    expect(st.srsStage).toBeLessThan(5); // actual: 9 = Quemado, nextDue = NEVER_DUE
  });
  it('XP +10 per right answer, lesson bonus once', () => {
    const s = useProgress.getState();
    s.recordAnswer('あ', 'kana', true);
    s.recordAnswer('い', 'kana', false);
    s.completeLesson('h-a');
    s.completeLesson('h-a');
    expect(useProgress.getState().xp).toBe(10 + 30);
    const today = useProgress.getState().daily[localDateString(new Date())]!;
    expect(today).toMatchObject({ correct: 1, wrong: 1, lessons: 2 });
  });
  it.fails('QA-019: repeating an already completed lesson does not count as another "lesson" in today\'s counter', () => {
    const s = useProgress.getState();
    s.completeLesson('h-a');
    s.completeLesson('h-a');
    expect(useProgress.getState().daily[localDateString(new Date())]!.lessons).toBe(1);
  });
  it('partial credit (kanji): SRS only, no XP / daily / streak', () => {
    useProgress.getState().recordAnswer('食', 'kanji', true, { partial: true });
    const st = useProgress.getState();
    expect(st.items['kanji:食']!.srsStage).toBe(1);
    expect(st.xp).toBe(0);
    expect(st.daily).toEqual({});
    expect(st.streak.count).toBe(0);
    expect(kanjiToCredit({ kanji: '食べ物' }, ['食'], new Set())).toEqual(['食']);
    expect(kanjiToCredit({ kanji: '食べ物' }, ['食'], new Set(['食']))).toEqual([]);
  });
  it('unlockKanji starts at Aprendiz 1, due in 4 h, keeps existing progress', () => {
    useProgress.getState().unlockKanji(['日']);
    const st = useProgress.getState().items['kanji:日']!;
    expect(st.srsStage).toBe(1);
    expect(st.nextDue - st.lastSeen).toBe(4 * H);
    useProgress.setState({ items: { 'kanji:日': { ...st, srsStage: 6 } } });
    useProgress.getState().unlockKanji(['日']);
    expect(useProgress.getState().items['kanji:日']!.srsStage).toBe(6);
  });
  it('daily.reviews only counts answers to due items', () => {
    const s = useProgress.getState();
    s.recordAnswer('あ', 'kana', true); // new item: not a review
    useProgress.setState({ items: { 'kana:い': item({ itemId: 'い', srsStage: 2, lastSeen: 1, nextDue: 1 }) } });
    s.recordAnswer('い', 'kana', true);
    expect(useProgress.getState().daily[localDateString(new Date())]!.reviews).toBe(1);
  });
});

describe('review of generated items (numbers / clock / calendar)', () => {
  it.fails('QA-005: a due `number:` item is the one asked in the review', () => {
    const now = Date.now();
    const items = { 'word:number:4173': item({ kind: 'word', itemId: 'number:4173', srsStage: 2, lastSeen: now - D, nextDue: now - H }) };
    const plan = planReview(items, now);
    const props = batchProps(plan.batches[0]!, content)!;
    // the numbers game ignores onlyItems and generates random numbers: the due item is (almost) never asked
    expect(props.onlyItems).toEqual(['number:4173']);
  });
  it('numbers create SRS items over a huge space (0-99,999), so due items accumulate', () => {
    const ids = new Set(Array.from({ length: 200 }, () => makeNumberQuestion('digits', 3, Math.random).itemId));
    expect(ids.size).toBeGreaterThan(150);
  });
});

describe('streak and daily counters (local time, Chile)', () => {
  it('runs in America/Santiago', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/Santiago');
  });
  it('same day keeps, next day +1, gap resets', () => {
    const s0 = { lastStudyDate: null, count: 0 };
    const d1 = touchStreak(s0, new Date(2026, 2, 10, 23, 30));
    expect(d1).toEqual({ lastStudyDate: '2026-03-10', count: 1 });
    expect(touchStreak(d1, new Date(2026, 2, 10, 23, 59))).toBe(d1);
    expect(touchStreak(d1, new Date(2026, 2, 11, 0, 5)).count).toBe(2);
    expect(touchStreak(d1, new Date(2026, 2, 12, 12)).count).toBe(1);
  });
  it('studying at 22:00 in Chile (01:00 UTC next day) counts for the local day', () => {
    const d = new Date('2026-03-11T01:00:00Z'); // 22:00 on the 10th in Chile (UTC-3)
    expect(localDateString(d)).toBe('2026-03-10');
  });
  it('DST changes in Chile (clocks back on 2026-04-05, forward on 2026-09-06) keep the streak', () => {
    expect(touchStreak({ lastStudyDate: '2026-04-04', count: 3 }, new Date(2026, 3, 5, 10)).count).toBe(4);
    expect(touchStreak({ lastStudyDate: '2026-09-05', count: 3 }, new Date(2026, 8, 6, 10)).count).toBe(4);
    expect(touchStreak({ lastStudyDate: '2026-09-05', count: 3 }, new Date(2026, 8, 6, 0, 30)).count).toBe(4);
  });
  it('last seven days, 90-day retention', () => {
    const now = new Date(2026, 9, 10, 12);
    const daily = bumpDaily({ '2026-01-01': { reviews: 1, lessons: 0, correct: 0, wrong: 0 } }, now, { correct: 1 });
    expect(Object.keys(daily)).toEqual(['2026-10-10']);
    const week = lastSevenDays(daily, { lastStudyDate: '2026-10-10', count: 1 }, now);
    expect(week.map((d) => d.label).join('')).toBe('DLMXJVS');
    expect(week.at(-1)).toMatchObject({ today: true, active: true });
  });
});

describe('levels', () => {
  it('curve 100, 250, 450 … level 10 = 2700 XP', () => {
    expect([2, 3, 4, 10].map(xpForLevel)).toEqual([100, 250, 450, 2700]);
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100)).toMatchObject({ level: 2, xpInto: 0, xpNeeded: 150 });
    expect(levelFromXp(-5).level).toBe(1);
  });
});

describe('import / export / localStorage', () => {
  it('round trip and defaults for old saves (no daily / sound / furigana)', () => {
    const p = createInitialProgress();
    expect(parseProgress(JSON.stringify(p))).toEqual({ ok: true, progress: p });
    const old = { ...p } as Record<string, unknown>;
    delete old.daily;
    old.settings = { showRomaji: true, ttsRate: 1, theme: 'dark' };
    const r = parseProgress(JSON.stringify(old));
    expect(r.ok && r.progress.settings.furigana).toBe('auto');
  });
  it('rejects invalid JSON and invalid data with a Spanish message', () => {
    expect(parseProgress('{')).toMatchObject({ ok: false, error: 'El archivo no es un JSON válido.' });
    const bad = { ...createInitialProgress(), xp: -1 };
    expect(parseProgress(JSON.stringify(bad)).ok).toBe(false);
  });
  it.fails('QA-017: a save from a future/older schema version is migrated, not rejected', () => {
    const v2 = { ...createInitialProgress(), version: 2 };
    expect(parseProgress(JSON.stringify(v2)).ok).toBe(true);
  });
  it('semantic garbage is accepted (unknown lesson ids, kana, nextDue in the past for burned items)', () => {
    const p = { ...createInitialProgress(), completedLessons: ['no-existe'], knownKana: ['X'] };
    expect(parseProgress(JSON.stringify(p)).ok).toBe(true);
  });
  it('corrupt saved progress: ignored, raw copy kept', () => {
    localStorage.setItem(STORAGE_KEY, '{"version":1');
    expect(loadProgress()).toBeNull();
    expect(localStorage.getItem(`${STORAGE_KEY}:corrupto`)).toBe('{"version":1');
  });
  it.fails('QA-018: a failing save (quota / private mode) is reported to the learner, not only console.warn', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('QuotaExceededError'); });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    saveProgress(createInitialProgress());
    const warned = warn.mock.calls.length;
    spy.mockRestore();
    warn.mockRestore();
    // the only signal is a console.warn: no loadIssue / banner / return value for save failures
    expect(warned).toBe(0);
  });
});
