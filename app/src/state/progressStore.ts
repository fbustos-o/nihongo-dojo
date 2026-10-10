import { useMemo } from 'react';
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
import { applyAnswer } from '../engine/srs';
import { touchStreak } from './streak';

const XP_PER_CORRECT = 10;

interface ProgressActions {
  /** Records one answer: updates the item's SRS state, XP and streak. */
  recordAnswer: (itemId: string, kind: ItemKind, correct: boolean) => void;
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

export const useProgress = create<ProgressStore>()((set) => ({
  ...(loadProgress() ?? createInitialProgress()),

  recordAnswer: (itemId, kind, correct) =>
    set((state) => {
      const now = Date.now();
      const key = itemKey(kind, itemId);
      const current = state.items[key] ?? {
        itemId,
        kind,
        srsStage: 0,
        correct: 0,
        wrong: 0,
        lastSeen: 0,
        nextDue: 0,
        weight: 1,
      };
      return {
        items: { ...state.items, [key]: applyAnswer(current, correct, now) },
        xp: state.xp + (correct ? XP_PER_CORRECT : 0),
        streak: touchStreak(state.streak, new Date(now)),
      };
    }),

  unlockKana: (chars) => set((state) => ({ knownKana: union(state.knownKana, chars) })),
  unlockKanji: (chars) => set((state) => ({ unlockedKanji: union(state.unlockedKanji, chars) })),
  unlockLesson: (lessonId) => set((state) => ({ unlockedLessons: union(state.unlockedLessons, [lessonId]) })),
  completeLesson: (lessonId) =>
    set((state) => ({
      unlockedLessons: union(state.unlockedLessons, [lessonId]),
      completedLessons: union(state.completedLessons, [lessonId]),
      streak: touchStreak(state.streak, new Date()),
    })),
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
  const { version, items, knownKana, unlockedKanji, unlockedLessons, completedLessons, xp, streak, settings } = state;
  return { version, items, knownKana, unlockedKanji, unlockedLessons, completedLessons, xp, streak, settings };
}

useProgress.subscribe((state) => saveProgress(snapshot(state)));

export const getProgressSnapshot = (): Progress => snapshot(useProgress.getState());

/** Unlock state consumed by the rendering rule (`renderPlan`). */
export function useUnlockState(): UnlockState {
  const knownKana = useProgress((s) => s.knownKana);
  const unlockedKanji = useProgress((s) => s.unlockedKanji);
  const items = useProgress((s) => s.items);
  return useMemo(
    () => ({
      knownKana: new Set(knownKana),
      kanji: new Map(unlockedKanji.map((char) => [char, items[itemKey('kanji', char)]?.srsStage ?? 0])),
    }),
    [knownKana, unlockedKanji, items],
  );
}
