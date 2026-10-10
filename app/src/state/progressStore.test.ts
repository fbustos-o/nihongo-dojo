import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseProgress, serializeProgress } from './persistence';
import { STORAGE_KEY, createInitialProgress } from './progressSchema';
import { getProgressSnapshot, useProgress } from './progressStore';
import { touchStreak } from './streak';

beforeEach(() => {
  useProgress.getState().resetProgress();
});

describe('recordAnswer', () => {
  it('advances the SRS stage, XP and streak on a correct answer', () => {
    useProgress.getState().recordAnswer('taberu', 'word', true);
    const state = useProgress.getState();
    const item = state.items['word:taberu']!;
    expect(item).toMatchObject({ itemId: 'taberu', kind: 'word', srsStage: 1, correct: 1, wrong: 0 });
    expect(item.nextDue).toBeGreaterThan(item.lastSeen);
    expect(state.xp).toBe(10);
    expect(state.streak.count).toBe(1);
  });

  it('drops the stage and raises the weight on a wrong answer', () => {
    const { recordAnswer } = useProgress.getState();
    recordAnswer('あ', 'kana', true);
    recordAnswer('あ', 'kana', true);
    recordAnswer('あ', 'kana', false);
    expect(useProgress.getState().items['kana:あ']).toMatchObject({ srsStage: 1, correct: 2, wrong: 1 });
    expect(useProgress.getState().items['kana:あ']!.weight).toBeGreaterThan(1);
  });
});

describe('persistence', () => {
  it('saves to the versioned key on every change', () => {
    useProgress.getState().unlockKana(['あ', 'い']);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.version).toBe(1);
    expect(saved.knownKana).toEqual(['あ', 'い']);
    expect(saved.unlockKana).toBeUndefined();
  });

  it('survives a throwing localStorage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => useProgress.getState().unlockKana(['う'])).not.toThrow();
    vi.restoreAllMocks();
  });

  it('round-trips export and import', () => {
    const { recordAnswer, unlockKana, importProgress } = useProgress.getState();
    unlockKana(['あ']);
    recordAnswer('あ', 'kana', true);
    const exported = serializeProgress(getProgressSnapshot());
    useProgress.getState().resetProgress();
    expect(importProgress(exported)).toBeNull();
    expect(useProgress.getState().knownKana).toEqual(['あ']);
    expect(useProgress.getState().xp).toBe(10);
  });

  it('rejects invalid imports without touching the state', () => {
    useProgress.getState().unlockKana(['あ']);
    expect(useProgress.getState().importProgress('not json')).toMatch(/JSON válido/);
    expect(useProgress.getState().importProgress('{"version":1}')).toMatch(/inválido/);
    expect(useProgress.getState().knownKana).toEqual(['あ']);
  });

  it('validates the schema', () => {
    const bad = { ...createInitialProgress(), version: 2 };
    expect(parseProgress(JSON.stringify(bad)).ok).toBe(false);
    expect(parseProgress(JSON.stringify(createInitialProgress())).ok).toBe(true);
  });
});

describe('lessons and settings', () => {
  it('completing a lesson unlocks and completes it once', () => {
    useProgress.getState().completeLesson('H1');
    useProgress.getState().completeLesson('H1');
    expect(useProgress.getState().completedLessons).toEqual(['H1']);
    expect(useProgress.getState().unlockedLessons).toEqual(['H1']);
  });

  it('merges settings patches', () => {
    useProgress.getState().updateSettings({ theme: 'dark' });
    expect(useProgress.getState().settings).toMatchObject({ theme: 'dark', showRomaji: true });
  });
});

describe('touchStreak', () => {
  const at = (iso: string) => new Date(`${iso}T12:00:00`);

  it('starts, keeps and extends a streak', () => {
    const first = touchStreak({ lastStudyDate: null, count: 0 }, at('2026-03-01'));
    expect(first).toEqual({ lastStudyDate: '2026-03-01', count: 1 });
    expect(touchStreak(first, at('2026-03-01'))).toBe(first);
    expect(touchStreak(first, at('2026-03-02'))).toEqual({ lastStudyDate: '2026-03-02', count: 2 });
  });

  it('resets after a missed day', () => {
    expect(touchStreak({ lastStudyDate: '2026-03-01', count: 5 }, at('2026-03-04'))).toEqual({
      lastStudyDate: '2026-03-04',
      count: 1,
    });
  });
});
