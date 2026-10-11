/* Content + engine access for the e2e solvers (QA E8). Reads the same JSON the app bundles. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { katakanaToHiragana } from '../../src/engine/kanaFilter';
import { readCounter, readDate, readDayOfWeek, readNumber, readPrice, readTime, type Counter } from '../../src/engine/numbers';
import { conjugateVerb, FORM_LABELS_ES, type VerbGroup } from '../../src/engine/conjugate';
import { ADJ_FORM_LABELS_ES, conjugateIAdjective, conjugateNaAdjective, conjugateNoun } from '../../src/engine/adjectives';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, '../../src/content');
const load = <T>(name: string): T => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as T;

export interface KanaEntry { char: string; romaji: string; script: 'hiragana' | 'katakana'; row: string; group: string; alt?: string[] }
export interface Word { id: string; kana: string; kanji?: string; romaji: string; es: string[]; pos: string; verbGroup?: VerbGroup; lesson: string; tags: string[] }
export interface Example { es: string; ja: string; romaji: string }
export interface Pattern { id: string; title: string; lesson: string; english: { slot: string; text: string }[]; japanese: unknown[]; examples?: Example[] }
export interface Line { speaker: 'A' | 'B'; ja: string; romaji: string; es: string }
export interface Dialogue { id: string; title: string; lesson: string; lines: Line[] }
export interface Lesson { id: string; stage: 1 | 2 | 3 | 4; title: string; requires: string[]; kana?: string[]; words?: string[]; patterns?: string[]; kanji?: string[]; dialogues?: string[]; games: string[] }
export interface Kanji { char: string; on: string[]; kun: string[]; es: string[]; genkiLesson: number; teach?: string[] }

export const kana = load<KanaEntry[]>('kana.json');
export const vocab = load<Word[]>('vocab.json');
export const patterns = load<Pattern[]>('patterns.json');
export const dialogues = load<Dialogue[]>('dialogues.json');
export const curriculum = load<Lesson[]>('curriculum.json');
export const kanji = load<Kanji[]>('kanji.json');

export { readCounter, readDate, readDayOfWeek, readNumber, readPrice, readTime, conjugateVerb, conjugateIAdjective, conjugateNaAdjective, conjugateNoun, katakanaToHiragana };
export type { Counter };

/** Normalises Japanese text for comparison: katakana -> hiragana, no spaces / punctuation. */
export const norm = (s: string): string => katakanaToHiragana(s).replace(/[\s。、？！?!,.・…「」]/gu, '');

/** Ancestors (transitive `requires`) of a lesson, plus the lesson itself when `self`. */
export function lessonsUpTo(id: string, self = false): string[] {
  const byId = new Map(curriculum.map((l) => [l.id, l]));
  const seen = new Set<string>();
  const visit = (lid: string) => byId.get(lid)?.requires.forEach((r) => { if (!seen.has(r)) { seen.add(r); visit(r); } });
  visit(id);
  if (self) seen.add(id);
  return curriculum.filter((l) => seen.has(l.id)).map((l) => l.id);
}

export const stageLessons = (stage: number): string[] => curriculum.filter((l) => l.stage === stage).map((l) => l.id);

export const FORM_BY_LABEL: Record<string, string> = Object.fromEntries([
  ...Object.entries(FORM_LABELS_ES).map(([id, v]) => [`verb|${v.label}`, id]),
  ...Object.entries(ADJ_FORM_LABELS_ES).map(([id, v]) => [`adj|${v.label}`, id]),
]);

/** Expected conjugation (primary kana) for a word + form label. */
export function conjugationAnswer(word: Word, label: string): string {
  if (word.pos === 'verb') {
    const id = FORM_BY_LABEL[`verb|${label}`]!;
    return (conjugateVerb(word.kana, word.verbGroup!) as Record<string, { kana: string }>)[id]!.kana;
  }
  const id = FORM_BY_LABEL[`adj|${label}`]!;
  const table = (word.pos === 'i-adj' ? conjugateIAdjective(word.kana) : word.pos === 'na-adj' ? conjugateNaAdjective(word.kana) : conjugateNoun(word.kana)) as Record<string, { kana: string }>;
  return table[id]!.kana;
}

let numberIndex: Map<string, number> | null = null;
/** kana -> number for 0..99,999 (numbers game "hear" mode), prices included. */
export function numberFromKana(k: string): number | undefined {
  if (!numberIndex) {
    numberIndex = new Map();
    for (let n = 0; n <= 99_999; n++) {
      numberIndex.set(readNumber(n).kana, n);
      const p = readPrice(n).kana;
      if (!numberIndex.has(p)) numberIndex.set(p, n);
    }
  }
  return numberIndex.get(k);
}

/** kana -> clock time (1..12 h). */
export function timeFromKana(k: string): { h: number; m: number } | undefined {
  for (let h = 1; h <= 12; h++) for (let m = 0; m < 60; m++) if (readTime(h, m).kana === k) return { h, m };
  return undefined;
}

export const SPANISH_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const SPANISH_WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const weekdayOf = (month: number, day: number): number => new Date(Date.UTC(2026, month - 1, day)).getUTCDay();
export function shiftDay(month: number, day: number, delta: number): { month: number; day: number } {
  const d = new Date(Date.UTC(2026, month - 1, day + delta));
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export const meaningText = (k: Kanji): string => k.es.slice(0, 2).join('; ');
