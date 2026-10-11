/* Progress fixtures (shape of src/state/progressSchema.ts, version 1). */
import type { Page } from '@playwright/test';
import { curriculum } from './content';

export const STORAGE_KEY = 'nihongo-dojo:v1';

export interface ItemState { itemId: string; kind: 'kana' | 'word' | 'kanji' | 'pattern' | 'dialogue'; srsStage: number; correct: number; wrong: number; lastSeen: number; nextDue: number; weight: number }

export interface ProgressOptions {
  completed?: string[];
  items?: ItemState[];
  xp?: number;
  streak?: { lastStudyDate: string | null; count: number };
  settings?: Partial<{ showRomaji: boolean; ttsRate: number; sound: boolean; theme: 'system' | 'light' | 'dark'; furigana: 'auto' | 'siempre' | 'nunca' }>;
  /** Override SRS stage of unlocked kanji. */
  kanjiStage?: number;
}

export function buildProgress(o: ProgressOptions = {}) {
  const completed = o.completed ?? [];
  const done = curriculum.filter((l) => completed.includes(l.id));
  const knownKana = [...new Set(done.flatMap((l) => l.kana ?? []))];
  const unlockedKanji = [...new Set(done.flatMap((l) => l.kanji ?? []))];
  const now = Date.now();
  const items: Record<string, ItemState> = {};
  for (const ch of unlockedKanji) {
    const stage = o.kanjiStage ?? 1;
    items[`kanji:${ch}`] = { itemId: ch, kind: 'kanji', srsStage: stage, correct: stage, wrong: 0, lastSeen: now - 1000, nextDue: now + 86_400_000, weight: 1 };
  }
  for (const it of o.items ?? []) items[`${it.kind}:${it.itemId}`] = it;
  return {
    version: 1,
    items,
    knownKana,
    unlockedKanji,
    unlockedLessons: completed,
    completedLessons: completed,
    xp: o.xp ?? 0,
    streak: o.streak ?? { lastStudyDate: null, count: 0 },
    daily: {},
    settings: { showRomaji: true, ttsRate: 0.9, sound: false, theme: 'system', furigana: 'auto', ...o.settings },
  };
}

/** A due item (seen yesterday, due one hour ago). */
export const dueItem = (kind: ItemState['kind'], itemId: string, srsStage = 2): ItemState => {
  const now = Date.now();
  return { itemId, kind, srsStage, correct: srsStage, wrong: 0, lastSeen: now - 86_400_000, nextDue: now - 3_600_000, weight: 1 };
};

/** Writes progress to localStorage before the app boots, then opens `path`. */
export async function seed(page: Page, progress: unknown, path = '/'): Promise<void> {
  await page.goto('/acerca-de');
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [STORAGE_KEY, JSON.stringify(progress)] as const);
  await page.goto(path);
}

export async function readProgress(page: Page): Promise<ReturnType<typeof buildProgress> | null> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}
