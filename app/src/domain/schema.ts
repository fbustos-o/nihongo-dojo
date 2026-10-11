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
  /** Spanish usage/grammar note; may contain Japanese. Games show `es` only. */
  note: z.string().optional(),
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
  /** Loanwords: language and source word, e.g. "inglés: television". Shown after answering. */
  origin: z.string().optional(),
  /** Explicit ruby segments `[text, reading]` for words the automatic alignment cannot split (今日 -> きょう). Kana-only segments have reading ''. */
  furigana: z.array(z.tuple([z.string(), z.string()])).optional(),
});
export type Word = z.infer<typeof WordSchema>;

export const KanjiSchema = z.object({
  char: z.string().min(1),
  on: z.array(z.string()),
  kun: z.array(z.string()),
  es: z.array(z.string()),
  genkiLesson: z.number().int(),
  words: z.array(z.string()),
  /** Readings Genki I teaches for this kanji (subset of `on` + `kun`, same notation). */
  teach: z.array(z.string()).optional(),
  /** Stroke count (KANJIDIC). */
  strokes: z.number().int().positive().optional(),
  /** Look-alike kanji of the Genki set (Kanjium + same radical), used as distractors. */
  similar: z.array(z.string()).optional(),
});
export type Kanji = z.infer<typeof KanjiSchema>;

/** One example sentence of a pattern. `ja` is kana with spaces between particles / bunsetsu. */
export const PatternExampleSchema = z.object({
  es: z.string(),
  ja: z.string(),
  romaji: z.string(),
});
export type PatternExample = z.infer<typeof PatternExampleSchema>;

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
  examples: z.array(PatternExampleSchema).optional(),
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
