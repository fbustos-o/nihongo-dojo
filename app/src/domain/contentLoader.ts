import type { ZodType } from 'zod';
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

/**
 * Validates a JSON list item by item: valid entries are kept, invalid ones are
 * dropped with a console warning. A missing file or a non-array yields [].
 */
function parseList<T>(file: string, schema: ZodType<T>, raw: unknown): T[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    console.warn(`[content] ${file}: se esperaba un arreglo; se ignora el archivo.`);
    return [];
  }
  const valid: T[] = [];
  let firstError: string | undefined;
  let invalid = 0;
  for (const [index, item] of raw.entries()) {
    const result = schema.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalid += 1;
      firstError ??= `#${index}: ${result.error.issues[0]?.path.join('.')} ${result.error.issues[0]?.message}`;
    }
  }
  if (invalid > 0) {
    console.warn(`[content] ${file}: ${invalid} entradas inválidas descartadas (primera ${firstError}).`);
  }
  return valid;
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
