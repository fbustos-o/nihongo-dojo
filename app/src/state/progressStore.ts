import { useContext, useMemo } from 'react';
import { ExtraKanaContext, ExtraKanjiContext } from './extraKana';
import { create } from 'zustand';
import type { UnlockState } from '../domain/renderPlan';
import { loadProgress, parseProgress, saveProgress } from './persistence';
import {
  createInitialProgress,
  itemKey,
  type ItemKind,
  type Progress,
  type Settings,
} from './progressSchema';
import { applyAnswer, dueTimeFor, isDue } from '../engine/srs';
import { levelFromXp } from '../engine/levels';
import { useCelebrations } from './celebrations';
import { bumpDaily } from './daily';
import { streakMilestone, touchStreak } from './streak';

/** XP for each first-try correct answer (single source: lesson summaries use it too). */
export const XP_PER_CORRECT = 10;
/** Bonus XP the first time a lesson is completed. */
export const LESSON_BONUS_XP = 30;

export interface RecordOptions {
  /**
   * Partial credit (a word answered right counts for its kanji): updates the item's SRS state only, with no
   * XP, daily counters or streak, so one answer is never counted twice.
   */
  partial?: boolean;
}

interface ProgressActions {
  /** Records one answer: updates the item's SRS state, XP and streak. */
  recordAnswer: (itemId: string, kind: ItemKind, correct: boolean, options?: RecordOptions) => void;
  unlockKana: (chars: Iterable<string>) => void;
  unlockKanji: (chars: Iterable<string>) => void;
  unlockLesson: (lessonId: string) => void;
  completeLesson: (lessonId: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  /** Replaces all progress with imported data; returns an error message on failure. */
  importProgress: (json: string) => string | null;
  resetProgress: () => void;
}

export type ProgressStore = Progress & ProgressActions;

const union = (current: string[], added: Iterable<string>): string[] => [...new Set([...current, ...added])];

/** Pushes level-up and streak-milestone celebrations. */
function celebrate(xpBefore: number, xpAfter: number, streakBefore: Progress['streak'], streakAfter: Progress['streak']): void {
  const { push } = useCelebrations.getState();
  const level = levelFromXp(xpAfter).level;
  if (level > levelFromXp(xpBefore).level) push({ kind: 'level', title: `¡Nivel ${level}!`, detail: 'Sigue así' });
  const milestone = streakMilestone(streakBefore, streakAfter);
  if (milestone) push({ kind: 'streak', title: `¡Racha de ${milestone} días!`, detail: 'Constancia de dojo' });
}

export const useProgress = create<ProgressStore>()((set) => ({
  ...(loadProgress() ?? createInitialProgress()),

  recordAnswer: (itemId, kind, correct, options) => {
    const before = useProgress.getState();
    const now = Date.now();
    const key = itemKey(kind, itemId);
    const current = before.items[key] ?? {
      itemId,
      kind,
      srsStage: 0,
      correct: 0,
      wrong: 0,
      lastSeen: 0,
      nextDue: 0,
      weight: 1,
    };
    const items = { ...before.items, [key]: applyAnswer(current, correct, now) };
    if (options?.partial) {
      set({ items });
      return;
    }
    const xp = before.xp + (correct ? XP_PER_CORRECT : 0);
    const streak = touchStreak(before.streak, new Date(now));
    set({
      items,
      xp,
      streak,
      daily: bumpDaily(before.daily, new Date(now), {
        reviews: isDue(current, now) ? 1 : 0,
        correct: correct ? 1 : 0,
        wrong: correct ? 0 : 1,
      }),
    });
    celebrate(before.xp, xp, before.streak, streak);
  },

  unlockKana: (chars) => set((state) => ({ knownKana: union(state.knownKana, chars) })),
  /** Unlocks kanji (JaText shows them with furigana) and starts them at SRS stage 1 (Aprendiz 1) unless already further. */
  unlockKanji: (chars) =>
    set((state) => {
      const now = Date.now();
      const list = [...new Set(chars)];
      const items = { ...state.items };
      for (const char of list) {
        const key = itemKey('kanji', char);
        const current = items[key];
        if (!current) {
          items[key] = { itemId: char, kind: 'kanji', srsStage: 1, correct: 0, wrong: 0, lastSeen: now, nextDue: dueTimeFor(1, now), weight: 1 };
        } else if (current.srsStage < 1) {
          items[key] = { ...current, srsStage: 1, lastSeen: current.lastSeen || now, nextDue: dueTimeFor(1, now) };
        }
      }
      return { unlockedKanji: union(state.unlockedKanji, list), items };
    }),
  unlockLesson: (lessonId) => set((state) => ({ unlockedLessons: union(state.unlockedLessons, [lessonId]) })),
  completeLesson: (lessonId) => {
    const before = useProgress.getState();
    const first = !before.completedLessons.includes(lessonId);
    const now = new Date();
    const streak = touchStreak(before.streak, now);
    const xp = before.xp + (first ? LESSON_BONUS_XP : 0);
    set({
      unlockedLessons: union(before.unlockedLessons, [lessonId]),
      completedLessons: union(before.completedLessons, [lessonId]),
      streak,
      xp,
      // QA-019: only the first completion counts as a lesson of the day; replays add nothing to the counter
      daily: first ? bumpDaily(before.daily, now, { lessons: 1 }) : before.daily,
    });
    if (first) useCelebrations.getState().push({ kind: 'lesson', title: '¡Lección completada!', detail: `+${LESSON_BONUS_XP} XP de bonificación` });
    celebrate(before.xp, xp, before.streak, streak);
  },
  updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),

  importProgress: (json) => {
    const parsed = parseProgress(json);
    if (!parsed.ok) return parsed.error;
    set(parsed.progress);
    return null;
  },
  resetProgress: () => set(createInitialProgress()),
}));

/** The persisted part of the store, without actions. */
function snapshot(state: ProgressStore): Progress {
  const { version, items, knownKana, unlockedKanji, unlockedLessons, completedLessons, xp, streak, daily, settings } = state;
  return { version, items, knownKana, unlockedKanji, unlockedLessons, completedLessons, xp, streak, daily, settings };
}

useProgress.subscribe((state) => saveProgress(snapshot(state)));

export const getProgressSnapshot = (): Progress => snapshot(useProgress.getState());

/** Unlock state consumed by the rendering rule (`renderPlan`). */
export function useUnlockState(): UnlockState {
  const knownKana = useProgress((s) => s.knownKana);
  const unlockedKanji = useProgress((s) => s.unlockedKanji);
  const items = useProgress((s) => s.items);
  const furigana = useProgress((s) => s.settings.furigana);
  const extraKana = useContext(ExtraKanaContext);
  const extraKanji = useContext(ExtraKanjiContext);
  return useMemo(
    () => ({
      knownKana: new Set([...knownKana, ...extraKana]),
      kanji: new Map([...unlockedKanji, ...extraKanji].map((char) => [char, items[itemKey('kanji', char)]?.srsStage ?? 0])),
      furigana,
    }),
    [knownKana, extraKana, extraKanji, unlockedKanji, items, furigana],
  );
}
