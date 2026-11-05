import { content } from '../domain/contentLoader';
import { glosses } from '../domain/glosses';
import type { Word } from '../domain/schema';
import { getMeaningLang, translate } from '../i18n';
import type { Lang } from '../state/progressSchema';
import { shuffle } from './kanaUtils';

/** Meaning shown for a word, in the meaning language (falls back to Spanish while a word has no translation). */
export const meaningOf = (word: Word, lang: Lang = getMeaningLang()): string => glosses(word, lang)[0] ?? word.romaji;

/** First word of a gloss, lower-case and without the parenthesised hint: «caluroso (clima)» -> «caluroso». */
const headword = (text: string): string => (text.toLowerCase().match(/\p{L}+/u) ?? [text])[0]!;

/** Whether `other` could be read as the same thing as `target` (homophone, or a gloss starting with the same word). */
export function overlapsMeaning(target: Word, other: Word, lang: Lang = getMeaningLang()): boolean {
  if (other.id === target.id || other.kana === target.kana) return true;
  const heads = new Set(glosses(target, lang).map(headword));
  return glosses(other, lang).some((e) => heads.has(headword(e)));
}

/**
 * Four meanings in the meaning language: the target's plus distractors that are not defensible answers (QA-014), shuffled.
 * With English, distractors come from words that have an English gloss, so the options never mix languages
 * (unless the target itself has none, in which case everything is Spanish).
 */
export function meaningChoices(
  target: Word,
  count = 4,
  all: readonly Word[] = content.vocab,
  rng: () => number = Math.random,
  lang: Lang = getMeaningLang(),
): { text: string; correct: boolean }[] {
  const targetLang: Lang = lang === 'en' && !(target.en && target.en.length > 0) ? 'es' : lang;
  const taken = new Set(glosses(target, targetLang));
  const distractors: string[] = [];
  const heads = new Set<string>();
  const sameLang = targetLang === 'en' ? all.filter((w) => w.en && w.en.length > 0) : all;
  for (const word of shuffle(sameLang.length >= count + 2 ? sameLang : all, rng)) {
    const text = meaningOf(word, targetLang);
    if (overlapsMeaning(target, word, targetLang) || taken.has(text) || distractors.includes(text) || heads.has(headword(text))) continue;
    distractors.push(text);
    heads.add(headword(text));
    if (distractors.length === count - 1) break;
  }
  return shuffle([{ text: meaningOf(target, targetLang), correct: true }, ...distractors.map((text) => ({ text, correct: false }))], rng);
}

/** The target word plus distractors with a different reading (taken from `pool`), shuffled. */
export function wordChoices(target: Word, pool: readonly Word[], count = 4, rng: () => number = Math.random): Word[] {
  const others = shuffle(
    pool.filter((w) => w.id !== target.id && w.kana !== target.kana),
    rng,
  );
  const distractors: Word[] = [];
  for (const w of others) {
    if (!distractors.some((d) => d.kana === w.kana)) distractors.push(w);
    if (distractors.length === count - 1) break;
  }
  return shuffle([target, ...distractors], rng);
}

/**
 * Loanword origin as stored («inglés: television», «inglés: smartphone (abreviado)») shown in `lang`: the language name
 * and the Spanish parenthetical hint are translated; the foreign word itself stays as is.
 */
export function originText(origin: string, lang: Lang = getMeaningLang()): string {
  const word = (kind: 'originLang' | 'originNote', key: string) => {
    const full = `games.${kind}.${key}`;
    const text = translate(lang, full);
    return text === full ? key : text;
  };
  const [name, ...rest] = origin.split(': ');
  const tail = rest.join(': ').replace(/\(([^)]*)\)/g, (_m, note: string) => `(${word('originNote', note)})`);
  return rest.length > 0 ? `${word('originLang', name!)}: ${tail}` : origin;
}
