import { z } from 'zod';

export const SCRIPTS = ['hiragana', 'katakana', 'kanji'] as const;
export const ScriptSchema = z.enum(SCRIPTS);
export type Script = z.infer<typeof ScriptSchema>;

export const GAME_IDS = [
  'kana-recognize',
  'kana-write',
  'read-words',
  'listen',
  'syntax',
  'particles',
  'conjugation',
  'numbers',
  'clock',
  'calendar',
  'dialogues',
  'mini-reading',
  'kanji',
] as const;
export const GameIdSchema = z.enum(GAME_IDS);
export type GameId = z.infer<typeof GameIdSchema>;

export const WordSchema = z.object({
  id: z.string().min(1),
  kana: z.string().min(1),
  kanji: z.string().optional(),
  romaji: z.string(),
  es: z.array(z.string()),
  pos: z.enum([
    'noun',
    'verb',
    'i-adj',
    'na-adj',
    'adverb',
    'expression',
    'counter',
    'particle',
    'pronoun',
  ]),
  verbGroup: z.enum(['u', 'ru', 'irregular']).optional(),
  lesson: z.string(),
  tags: z.array(z.string()),
  source: z.enum(['genki', 'profesor', 'propio']),
});
export type Word = z.infer<typeof WordSchema>;

export const KanjiSchema = z.object({
  char: z.string().min(1),
  on: z.array(z.string()),
  kun: z.array(z.string()),
  es: z.array(z.string()),
  genkiLesson: z.number().int(),
  words: z.array(z.string()),
});
export type Kanji = z.infer<typeof KanjiSchema>;

export const SentencePatternSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  lesson: z.string(),
  english: z.array(
    z.object({
      slot: z.enum(['S', 'V', 'O', 'DIR', 'BE', 'ADJ', 'N']),
      text: z.string(),
    }),
  ),
  japanese: z.array(
    z.object({
      slot: z.string(),
      text: z.string(),
      particle: z.string().optional(),
    }),
  ),
  explanationEs: z.string(),
});
export type SentencePattern = z.infer<typeof SentencePatternSchema>;

export const DialogueSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  lesson: z.string(),
  lines: z.array(
    z.object({
      speaker: z.enum(['A', 'B']),
      ja: z.string(),
      romaji: z.string(),
      es: z.string(),
    }),
  ),
});
export type Dialogue = z.infer<typeof DialogueSchema>;

export const LessonSchema = z.object({
  id: z.string().min(1),
  stage: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  title: z.string(),
  requires: z.array(z.string()),
  kana: z.array(z.string()).optional(),
  words: z.array(z.string()).optional(),
  patterns: z.array(z.string()).optional(),
  kanji: z.array(z.string()).optional(),
  dialogues: z.array(z.string()).optional(),
  games: z.array(GameIdSchema),
});
export type Lesson = z.infer<typeof LessonSchema>;

export const KanaEntrySchema = z.object({
  char: z.string().min(1),
  romaji: z.string().min(1),
  script: z.enum(['hiragana', 'katakana']),
  row: z.string(),
  group: z.enum(['gojuon', 'dakuten', 'handakuten', 'yoon', 'extended']),
  /** Extra accepted IME romaji (e.g. を: wo). */
  alt: z.array(z.string()).optional(),
});
export type KanaEntry = z.infer<typeof KanaEntrySchema>;
