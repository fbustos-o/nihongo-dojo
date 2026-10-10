import { parseList } from './parseList';
import {
  DialogueSchema,
  KanaEntrySchema,
  KanjiSchema,
  LessonSchema,
  SentencePatternSchema,
  WordSchema,
  type Dialogue,
  type KanaEntry,
  type Kanji,
  type Lesson,
  type SentencePattern,
  type Word,
} from './schema';

export interface Content {
  kana: KanaEntry[];
  vocab: Word[];
  kanji: Kanji[];
  patterns: SentencePattern[];
  dialogues: Dialogue[];
  curriculum: Lesson[];
  /** Free-form until E2 defines its shape. */
  numbers: unknown;
}

/** Builds the typed content object from a map of `<name>.json` file contents. */
export function loadContent(files: Record<string, unknown>): Content {
  return {
    kana: parseList('kana.json', KanaEntrySchema, files['kana']),
    vocab: parseList('vocab.json', WordSchema, files['vocab']),
    kanji: parseList('kanji.json', KanjiSchema, files['kanji']),
    patterns: parseList('patterns.json', SentencePatternSchema, files['patterns']),
    dialogues: parseList('dialogues.json', DialogueSchema, files['dialogues']),
    curriculum: parseList('curriculum.json', LessonSchema, files['curriculum']),
    numbers: files['numbers'],
  };
}

const modules = import.meta.glob<unknown>('../content/*.json', {
  eager: true,
  import: 'default',
});

const files: Record<string, unknown> = {};
for (const [path, data] of Object.entries(modules)) {
  const name = path.split('/').pop()?.replace(/\.json$/, '');
  if (name) files[name] = data;
}

export const content: Content = loadContent(files);
