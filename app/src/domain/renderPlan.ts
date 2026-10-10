import { isHiragana, isKanji, isKatakana, toHiragana, toRomaji } from 'wanakana';
import { alignFurigana } from './furigana';

/** What the learner has unlocked so far; drives how every word is displayed. */
export interface UnlockState {
  /** Kana characters (hiragana and/or katakana) the learner can read. */
  knownKana: ReadonlySet<string>;
  /** Unlocked kanji mapped to their SRS stage (0..8). */
  kanji: ReadonlyMap<string, number>;
}

export type Segment =
  | { type: 'text'; text: string }
  | { type: 'romaji'; text: string }
  | { type: 'ruby'; base: string; reading: string };

export interface RenderableWord {
  kana: string;
  kanji?: string;
}

/** SRS stage from which furigana is no longer shown (Guru). */
export const FURIGANA_HIDDEN_STAGE = 5;

const LONG_MARK = 'ー';

function romajiRun(source: string): string {
  // wanakana turns ー into "-"/duplicated vowels inconsistently, so lengthen the previous vowel ourselves.
  let out = '';
  for (const piece of source.split(LONG_MARK)) {
    if (out) out += out.match(/[aiueo](?=[^aiueo]*$)/)?.[0] ?? '';
    out += toRomaji(piece);
  }
  return out;
}

function pushMerged(segments: Segment[], segment: Segment): void {
  const last = segments.at(-1);
  if (last && segment.type !== 'ruby' && last.type === segment.type) {
    last.text += segment.text;
  } else {
    segments.push(segment);
  }
}

/**
 * Renders a kana string for the learner: known kana stay as they are, unknown
 * katakana falls back to the equivalent hiragana, and anything still unknown
 * becomes romaji. Non-kana characters pass through untouched.
 */
export function renderKana(text: string, knownKana: ReadonlySet<string>): Segment[] {
  const segments: Segment[] = [];
  let pendingRomaji = '';
  let lastWasKana = false;

  const flush = () => {
    if (pendingRomaji) pushMerged(segments, { type: 'romaji', text: romajiRun(pendingRomaji) });
    pendingRomaji = '';
  };

  for (const char of text) {
    if (char === LONG_MARK && lastWasKana) {
      if (pendingRomaji) pendingRomaji += char;
      else pushMerged(segments, { type: 'text', text: char });
      continue;
    }
    lastWasKana = false;
    if (isHiragana(char) || isKatakana(char)) {
      lastWasKana = true;
      const hiragana = toHiragana(char);
      const shown = knownKana.has(char) ? char : knownKana.has(hiragana) && hiragana !== char ? hiragana : undefined;
      if (shown) {
        flush();
        pushMerged(segments, { type: 'text', text: shown });
      } else {
        pendingRomaji += char;
      }
    } else {
      flush();
      pushMerged(segments, { type: 'text', text: char });
    }
  }
  flush();
  return segments;
}

/**
 * Core pedagogical rule: decides how a word is shown given what is unlocked.
 *  - unknown kana -> romaji; unlocked-less katakana -> its hiragana;
 *  - unlocked kanji -> kanji with `<ruby>` furigana;
 *  - kanji block whose characters are all at SRS stage >= Guru -> no furigana;
 *  - kanji block with any locked character -> shown as its kana reading.
 */
export function renderPlan(word: RenderableWord, state: UnlockState): Segment[] {
  if (!word.kanji) return renderKana(word.kana, state.knownKana);

  const segments: Segment[] = [];
  for (const part of alignFurigana(word.kanji, word.kana)) {
    if (part.type === 'kana') {
      for (const s of renderKana(part.text, state.knownKana)) pushMerged(segments, s);
      continue;
    }
    const stages = [...part.base].filter((char) => isKanji(char)).map((char) => state.kanji.get(char));
    const unlocked = stages.every((stage) => stage !== undefined);
    if (!unlocked) {
      for (const s of renderKana(part.reading, state.knownKana)) pushMerged(segments, s);
    } else if (stages.every((stage) => stage! >= FURIGANA_HIDDEN_STAGE)) {
      pushMerged(segments, { type: 'text', text: part.base });
    } else {
      const reading = renderKana(part.reading, state.knownKana)
        .map((s) => (s.type === 'ruby' ? s.base : s.text))
        .join('');
      segments.push({ type: 'ruby', base: part.base, reading });
    }
  }
  return segments;
}
