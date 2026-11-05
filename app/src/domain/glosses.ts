import type { Lang } from '../state/progressSchema';
import type { Dialogue, Kanji, Lesson, SentencePattern, Word } from './schema';

/**
 * Meanings of a word in the learner's meaning language. English falls back to Spanish while a word has no `en`
 * (content is translated progressively), so games never show an empty answer.
 */
export function glosses(word: Pick<Word, 'es' | 'en'>, lang: Lang): string[] {
  if (lang === 'en' && word.en && word.en.length > 0) return word.en;
  return word.es;
}

export const kanjiMeanings = (kanji: Pick<Kanji, 'es' | 'en'>, lang: Lang): string[] =>
  lang === 'en' && kanji.en && kanji.en.length > 0 ? kanji.en : kanji.es;

export const lessonTitle = (lesson: Pick<Lesson, 'title' | 'titleEn'>, lang: Lang): string =>
  (lang === 'en' && lesson.titleEn) || lesson.title;

export const patternTitle = (p: Pick<SentencePattern, 'title' | 'titleEn'>, lang: Lang): string => (lang === 'en' && p.titleEn) || p.title;

export const patternExplanation = (p: Pick<SentencePattern, 'explanationEs' | 'explanationEn'>, lang: Lang): string =>
  (lang === 'en' && p.explanationEn) || p.explanationEs;

export const exampleTranslation = (ex: { es: string; en?: string }, lang: Lang): string => (lang === 'en' && ex.en) || ex.es;

export const dialogueTitle = (d: Pick<Dialogue, 'title' | 'titleEn'>, lang: Lang): string => (lang === 'en' && d.titleEn) || d.title;

export const lineTranslation = (line: { es: string; en?: string }, lang: Lang): string => (lang === 'en' && line.en) || line.es;

export const wordNote = (word: Pick<Word, 'note' | 'noteEn'>, lang: Lang): string | undefined =>
  lang === 'en' ? word.noteEn || word.note : word.note;
