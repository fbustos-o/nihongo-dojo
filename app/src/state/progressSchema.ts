import { z } from 'zod';
import { DailySchema } from './daily';

export const STORAGE_KEY = 'nihongo-dojo:v1';
export const PROGRESS_VERSION = 1;
export const MAX_SRS_STAGE = 9;

export const ItemKindSchema = z.enum(['kana', 'word', 'kanji', 'pattern', 'dialogue']);
export type ItemKind = z.infer<typeof ItemKindSchema>;

export const ItemStateSchema = z.object({
  itemId: z.string(),
  kind: ItemKindSchema,
  /** 0 = new, 1-4 Aprendiz, 5-6 Guru, 7 Maestro, 8 Iluminado, 9 Quemado (see engine/srs.ts). */
  srsStage: z.number().int().min(0).max(MAX_SRS_STAGE),
  correct: z.number().int().min(0),
  wrong: z.number().int().min(0),
  /** Epoch ms; 0 = never. */
  lastSeen: z.number().min(0),
  nextDue: z.number().min(0),
  /** Relative probability of being picked by the weighted selector. */
  weight: z.number().positive(),
});
export type ItemState = z.infer<typeof ItemStateSchema>;

export const ThemeSchema = z.enum(['system', 'light', 'dark']);
export type Theme = z.infer<typeof ThemeSchema>;

export const FuriganaModeSchema = z.enum(['auto', 'siempre', 'nunca']);

/** Kana typing: `auto` = on-screen keyboard on touch devices, romaji->kana IME on desktop. */
export const KanaInputModeSchema = z.enum(['auto', 'teclado', 'romaji']);
export type KanaInputMode = z.infer<typeof KanaInputModeSchema>;

export const SettingsSchema = z.object({
  showRomaji: z.boolean(),
  ttsRate: z.number().min(0.5).max(1.5),
  /** Sound effects in games. Off by default. */
  sound: z.boolean().default(false),
  theme: ThemeSchema,
  /** Furigana over unlocked kanji: `auto` = fade out from SRS stage Guru, `siempre`, `nunca`. */
  furigana: FuriganaModeSchema.default('auto'),
  /** How kana are typed in the games. Absent in old saves. */
  kanaInput: KanaInputModeSchema.default('auto'),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const ProgressSchema = z.object({
  version: z.literal(PROGRESS_VERSION),
  items: z.record(z.string(), ItemStateSchema),
  knownKana: z.array(z.string()),
  unlockedKanji: z.array(z.string()),
  unlockedLessons: z.array(z.string()),
  completedLessons: z.array(z.string()),
  xp: z.number().int().min(0),
  streak: z.object({
    /** Local date as YYYY-MM-DD, or null if the learner never studied. */
    lastStudyDate: z.string().nullable(),
    count: z.number().int().min(0),
  }),
  /** Per-date activity counters (reviews, lessons, correct, wrong). Absent in old saves. */
  daily: DailySchema.default({}),
  settings: SettingsSchema,
});
export type Progress = z.infer<typeof ProgressSchema>;

export const itemKey = (kind: ItemKind, itemId: string): string => `${kind}:${itemId}`;

export function createInitialProgress(): Progress {
  return {
    version: PROGRESS_VERSION,
    items: {},
    knownKana: [],
    unlockedKanji: [],
    unlockedLessons: [],
    completedLessons: [],
    xp: 0,
    streak: { lastStudyDate: null, count: 0 },
    daily: {},
    settings: { showRomaji: true, ttsRate: 0.9, sound: false, theme: 'system', furigana: 'auto', kanaInput: 'auto' },
  };
}
