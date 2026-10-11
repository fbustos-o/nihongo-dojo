import { toKana, toKatakana } from 'wanakana';
import { katakanaToHiragana } from './kanaFilter';

export interface AnswerOptions {
  /** Other accepted answers (e.g. しち / なな, じゅっぷん / じっぷん). */
  alternatives?: readonly string[];
  /**
   * Particle mode. Off (default): a pronunciation-equivalent spelling is accepted
   * (こんにちわ for こんにちは, お for を, え for へ). On: は/わ, を/お and へ/え are different answers.
   */
  strict?: boolean;
  /** Keep hiragana and katakana distinct. Default false (コーヒー = こーひー). */
  scriptSensitive?: boolean;
  /** Remove spaces from the input and the answers. Default true. */
  ignoreSpaces?: boolean;
  /** Convert latin letters to kana before comparing. Default true. */
  romajiToKana?: boolean;
}

export interface AnswerResult {
  correct: boolean;
  /** The input after normalization (relative to the matching, or else the first, expected answer). */
  normalizedInput: string;
  /** The expected answer as given: the one that matched, else the primary. */
  expected: string;
  /** True when the answer is wrong but within one edit of an expected answer (longer than 3 kana). */
  nearMiss: boolean;
}

/** Levenshtein edit distance between two strings, counted in code points. */
export function levenshtein(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  if (x.length === 0) return y.length;
  if (y.length === 0) return x.length;
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const row = [i];
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      row.push(Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost));
    }
    prev = row;
  }
  return prev[y.length]!;
}

const HAS_LATIN = /[a-z]/;
const HAS_KATAKANA = /[ァ-ヺ]/;
const HAS_HIRAGANA = /[ぁ-ゖ]/;

type Target = 'hiragana' | 'katakana';

/**
 * Normalizes a typed answer or an expected answer:
 * NFKC (full-width -> half-width ASCII, half-width katakana -> full-width), trim, lowercase,
 * optional space removal, romaji -> kana (wanakana), punctuation removal (ー is kept) and
 * katakana -> hiragana unless `scriptSensitive`.
 */
export function normalizeAnswer(text: string, options: AnswerOptions = {}, target: Target = 'hiragana'): string {
  const { scriptSensitive = false, ignoreSpaces = true, romajiToKana = true } = options;
  let s = text.normalize('NFKC').trim().toLowerCase();
  // A typed hyphen is the long-vowel mark (the katakana IME writes ー for `-`).
  s = s.replace(/-/g, 'ー');
  s = ignoreSpaces ? s.replace(/\s+/gu, '') : s.replace(/\s+/gu, ' ');
  if (romajiToKana && HAS_LATIN.test(s)) {
    s = scriptSensitive && target === 'katakana' ? toKatakana(s) : toKana(s);
  }
  s = s.replace(/[\p{P}\p{S}]/gu, '');
  if (!scriptSensitive) s = katakanaToHiragana(s);
  return s;
}

const LONG_VOWEL_ROW: Record<string, [string, string]> = {};
for (const [row, same] of [
  ['あかさたなはまやらわがざだばぱぁゃゎ', 'あ'],
  ['いきしちにひみりぎじぢびぴぃ', 'い'],
  ['うくすつぬふむゆるぐずづぶぷぅゅ', 'う'],
  ['えけせてねへめれげぜでべぺぇ', 'え'],
  ['おこそとのほもよろをごぞどぼぽぉょ', 'お'],
] as const) {
  for (const ch of row) LONG_VOWEL_ROW[ch] = [same, same === 'お' ? 'う' : same];
}

const HIRAGANA_VOWELS = ['あ', 'い', 'う', 'え', 'お'];
const KATAKANA_VOWELS = ['ア', 'イ', 'ウ', 'エ', 'オ'];

/**
 * Expands ー after a kana into a vowel: コーヒー -> こおひい and こうひい (hiragana), or コオヒイ and
 * コウヒイ (katakana, script-sensitive matching: wanakana turns `koohii` into コオヒイ, not コーヒー).
 */
function expandLongMarks(s: string): string[] {
  if (!s.includes('ー')) return [];
  const build = (variant: 0 | 1): string => {
    let out = '';
    for (const ch of s) {
      if (ch === 'ー') {
        const prev = out.slice(-1);
        const isKatakana = HAS_KATAKANA.test(prev);
        const entry = LONG_VOWEL_ROW[isKatakana ? katakanaToHiragana(prev) : prev];
        const vowel = entry?.[variant];
        out += vowel ? (isKatakana ? KATAKANA_VOWELS[HIRAGANA_VOWELS.indexOf(vowel)]! : vowel) : ch;
      } else out += ch;
    }
    return out;
  };
  return [...new Set([build(0), build(1)])];
}

/** Pronunciation-equivalent particle spellings: ...は -> ...わ, を -> お, ...へ -> ...え. */
function lenientParticleVariants(s: string): string[] {
  const variants = new Set<string>([s]);
  const withO = s.replace(/を/g, 'お');
  variants.add(withO);
  for (const v of [...variants]) {
    if (v.endsWith('は')) variants.add(`${v.slice(0, -1)}わ`);
    if (v.endsWith('へ')) variants.add(`${v.slice(0, -1)}え`);
  }
  return [...variants];
}

const MAX_PARTICLE_TOKENS = 4;

/**
 * Spellings of an expected answer with its isolated topic / direction particle tokens (a whitespace-separated
 * 「は」 or 「へ」) read as they sound (わ / え), in every combination (QA-012). Only whole tokens count, so words
 * that contain は / へ (はな, へや, こんにちは) are untouched. Text without spaces has no tokens: only the
 * end-of-string rule of `lenientParticleVariants` applies there.
 */
export function particleSpellings(expected: string): string[] {
  const tokens = expected.normalize('NFKC').trim().split(/\s+/u);
  const slots = tokens.flatMap((t, i) => (t === 'は' || t === 'へ' ? [i] : [])).slice(0, MAX_PARTICLE_TOKENS);
  const spellings: string[] = [];
  for (let mask = 0; mask < 1 << slots.length; mask++) {
    const copy = [...tokens];
    slots.forEach((index, bit) => {
      if (mask & (1 << bit)) copy[index] = tokens[index] === 'は' ? 'わ' : 'え';
    });
    spellings.push(copy.join(' '));
  }
  return spellings;
}

function expectedVariants(normalized: string, strict: boolean): string[] {
  const bases = [normalized, ...expandLongMarks(normalized)];
  return strict ? bases : [...new Set(bases.flatMap(lenientParticleVariants))];
}

const targetOf = (expected: string): Target =>
  HAS_KATAKANA.test(expected) && !HAS_HIRAGANA.test(expected) ? 'katakana' : 'hiragana';

/**
 * Checks a typed answer against the expected answer (and alternatives).
 * See AnswerOptions for the lenient / strict particle behaviour.
 */
export function checkAnswer(input: string, expected: string | readonly string[], options: AnswerOptions = {}): AnswerResult {
  const candidates = [...(typeof expected === 'string' ? [expected] : expected), ...(options.alternatives ?? [])];
  if (candidates.length === 0) throw new Error('checkAnswer needs at least one expected answer');
  const strict = options.strict ?? false;

  let nearest: { candidate: string; normalizedInput: string } | null = null;
  let primaryInput = '';
  for (const [index, candidate] of candidates.entries()) {
    const normalizedInput = normalizeAnswer(input, options, targetOf(candidate));
    if (index === 0) primaryInput = normalizedInput;
    const spellings = strict ? [candidate] : particleSpellings(candidate);
    const variants = [...new Set(spellings.flatMap((s) => expectedVariants(normalizeAnswer(s, options, targetOf(candidate)), strict)))];
    if (normalizedInput !== '' && variants.includes(normalizedInput)) {
      return { correct: true, normalizedInput, expected: candidate, nearMiss: false };
    }
    if (
      normalizedInput !== '' &&
      !nearest &&
      variants.some((v) => Array.from(v).length > 3 && levenshtein(normalizedInput, v) <= 1)
    ) {
      nearest = { candidate, normalizedInput };
    }
  }
  return {
    correct: false,
    normalizedInput: nearest?.normalizedInput ?? primaryInput,
    expected: nearest?.candidate ?? candidates[0]!,
    nearMiss: nearest !== null,
  };
}
