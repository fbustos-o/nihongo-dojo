import { levelFromXp } from '../engine/levels';
import { useCelebrations } from './celebrations';
import { localDateString, STREAK_MILESTONES, streakMilestone } from './streak';
import { LESSON_BONUS_XP, useProgress } from './progressStore';

beforeEach(() => {
  vi.useRealTimers();
  useProgress.getState().resetProgress();
  useCelebrations.getState().clear();
});
afterEach(() => vi.useRealTimers());

const today = () => useProgress.getState().daily[localDateString(new Date())];

describe('daily counters in the store', () => {
  it('counts correct and wrong answers; reviews only for items that were due', () => {
    const { recordAnswer } = useProgress.getState();
    recordAnswer('あ', 'kana', true); // brand new: not a review
    expect(today()).toEqual({ reviews: 0, lessons: 0, correct: 1, wrong: 0 });
    recordAnswer('い', 'kana', false); // new, wrong -> stage 0, due at once
    recordAnswer('い', 'kana', true); // a review
    expect(today()).toEqual({ reviews: 1, lessons: 0, correct: 2, wrong: 1 });
  });
  it('counts only the first completion as a lesson (QA-019) and gives the XP bonus only the first time', () => {
    const { completeLesson } = useProgress.getState();
    completeLesson('h-a');
    completeLesson('h-a');
    expect(today()!.lessons).toBe(1);
    expect(useProgress.getState().xp).toBe(LESSON_BONUS_XP);
  });
  it('is saved, exported and restored', () => {
    useProgress.getState().recordAnswer('あ', 'kana', true);
    const saved = JSON.parse(localStorage.getItem('nihongo-dojo:v1')!);
    expect(saved.daily[localDateString(new Date())].correct).toBe(1);
  });
  it('partial credit moves the SRS stage but not XP, daily counters or streak', () => {
    useProgress.getState().unlockKanji(['食']);
    useProgress.setState((s) => ({ items: { ...s.items, 'kanji:食': { ...s.items['kanji:食']!, nextDue: 1 } } }));
    const before = useProgress.getState();
    before.recordAnswer('食', 'kanji', true, { partial: true });
    const after = useProgress.getState();
    expect(after.items['kanji:食']!.srsStage).toBe(2);
    expect(after.xp).toBe(0);
    expect(after.daily).toEqual({});
    expect(after.streak).toEqual(before.streak);
  });
});

describe('celebrations', () => {
  it('announces a lesson completed (once) and a level up', () => {
    const { completeLesson } = useProgress.getState();
    completeLesson('h-a');
    completeLesson('h-a');
    expect(useCelebrations.getState().queue.map((c) => c.kind)).toEqual(['lesson']);
    // 10 correct answers = 100 XP: 30 (bonus) + 80 -> level 2 is crossed at 100
    for (let i = 0; i < 7; i++) useProgress.getState().recordAnswer(`k${i}`, 'kana', true);
    expect(levelFromXp(useProgress.getState().xp).level).toBe(2);
    expect(useCelebrations.getState().queue.map((c) => c.kind)).toEqual(['lesson', 'level']);
    expect(useCelebrations.getState().queue[1]!.title).toBe('¡Nivel 2!');
  });
  it('announces streak milestones', () => {
    expect(STREAK_MILESTONES).toContain(7);
    expect(streakMilestone({ lastStudyDate: 'a', count: 6 }, { lastStudyDate: 'b', count: 7 })).toBe(7);
    expect(streakMilestone({ lastStudyDate: 'a', count: 7 }, { lastStudyDate: 'a', count: 7 })).toBeNull();
    expect(streakMilestone({ lastStudyDate: 'a', count: 4 }, { lastStudyDate: 'b', count: 5 })).toBeNull();
    const d = new Date();
    d.setDate(d.getDate() - 1);
    useProgress.setState({ streak: { lastStudyDate: localDateString(d), count: 2 } });
    useProgress.getState().recordAnswer('あ', 'kana', true);
    expect(useCelebrations.getState().queue.map((c) => c.kind)).toContain('streak');
  });
  it('keeps at most a few queued', () => {
    for (let i = 0; i < 9; i++) useCelebrations.getState().push({ kind: 'level', title: String(i) });
    expect(useCelebrations.getState().queue).toHaveLength(5);
  });
});
