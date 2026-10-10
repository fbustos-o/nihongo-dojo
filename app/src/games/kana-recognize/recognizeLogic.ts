import { content } from '../../domain/contentLoader';
import type { KanaEntry } from '../../domain/schema';
import { katakanaToHiragana } from '../../engine';
import { confusableChoices } from '../confusables';
import { kanaChoices } from '../kanaUtils';

/** Share of the rounds of a katakana lesson (already seen kana) that are hiragana <-> katakana. */
export const SCRIPT_PAIR_RATE = 0.25;

export type RecognizeQuestion =
  | { kind: 'type'; entry: KanaEntry }
  | { kind: 'choice'; entry: KanaEntry; choices: KanaEntry[] }
  /** Show `shown`, pick `answer` (the same sound in the other script) among `choices`. `entry` is the lesson kana (progress item). */
  | { kind: 'script-pair'; entry: KanaEntry; shown: KanaEntry; answer: KanaEntry; choices: KanaEntry[] };

/** The same sound in the other script (ア <-> あ). Null when there is none (ー, ヴ, ティ...). */
export function scriptPartner(entry: KanaEntry, all: readonly KanaEntry[] = content.kana): KanaEntry | null {
  const wantHiragana = entry.script === 'katakana';
  const char = wantHiragana ? katakanaToHiragana(entry.char) : entry.char.replace(/[ぁ-ゖ]/gu, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
  if (char === entry.char) return null;
  return all.find((k) => k.char === char && k.script === (wantHiragana ? 'hiragana' : 'katakana')) ?? null;
}

export interface BuildOptions {
  /** The kana is brand new in this lesson (first time): multiple choice of romaji. */
  isNew: boolean;
  /** Kana the learner can read (progress + lesson), used to keep distractors fair. */
  known: ReadonlySet<string>;
  all?: readonly KanaEntry[];
  rng?: () => number;
  /** Enables the hiragana <-> katakana round type (katakana lessons). */
  scriptPairs?: boolean;
  pairRate?: number;
}

/**
 * Decides how a kana is asked. In katakana lessons the multiple-choice distractors are the classic
 * look-alikes (シ/ツ, ソ/ン...) the learner already met, and some rounds ask for the same sound in the
 * other script. Pure: pass `rng` for deterministic tests.
 */
export function buildRecognizeQuestion(entry: KanaEntry, options: BuildOptions): RecognizeQuestion {
  const { isNew, known, all = content.kana, rng = Math.random, scriptPairs = false, pairRate = SCRIPT_PAIR_RATE } = options;
  const katakana = entry.script === 'katakana';
  if (!isNew && katakana && scriptPairs) {
    const partner = scriptPartner(entry, all);
    if (partner && rng() < pairRate) {
      // Alternate the direction: show katakana -> pick hiragana, or show hiragana -> pick katakana.
      const showPartner = rng() < 0.5;
      const shown = showPartner ? partner : entry;
      const answer = showPartner ? entry : partner;
      const allowed = new Set([...known, entry.char, partner.char]);
      return { kind: 'script-pair', entry, shown, answer, choices: confusableChoices(answer, allowed, 4, all, rng) };
    }
  }
  if (!isNew) return { kind: 'type', entry };
  const choices = katakana ? confusableChoices(entry, new Set([...known, entry.char]), 4, all, rng) : kanaChoices(entry, 4, all, rng);
  return { kind: 'choice', entry, choices };
}
