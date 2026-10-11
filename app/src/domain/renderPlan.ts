import { isHiragana, isKanji, isKatakana, toHiragana, toRomaji } from 'wanakana';
import { alignFurigana, type FuriganaPart } from './furigana';

/** What the learner has unlocked so far; drives how every word is displayed. */
export interface UnlockState {
  /** Kana characters (hiragana and/or katakana) the learner can read. */
  knownKana: ReadonlySet<string>;
  /** Unlocked kanji mapped to their SRS stage (0..8). */
  kanji: ReadonlyMap<string, number>;
  /** Furigana setting: `auto` fades them with the SRS stage (default), `siempre` keeps them, `nunca` hides them. */
  furigana?: FuriganaMode;
}

export type FuriganaMode = 'auto' | 'siempre' | 'nunca';

export type Segment =
  | { type: 'text'; text: string }
  | { type: 'romaji'; text: string }
  /** A kana the learner does not know yet, kept as kana with its romaji as ruby (`romajiMode: 'ruby'`). */
  | { type: 'kanaRuby'; kana: string; romaji: string }
  | { type: 'ruby'; base: string; reading: string };

/**
 * How still-locked kana are shown. `ruby` (default): the text stays in kana and each unknown kana unit carries its romaji
 * as ruby. `inline`: unknown kana are replaced by romaji runs mixed into the kana (the old behaviour).
 */
export type RomajiMode = 'ruby' | 'inline';

export interface RenderableWord {
  kana: string;
  kanji?: string;
  /** Explicit `[text, reading]` segments (reading '' = plain kana); overrides the automatic alignment. */
  furigana?: readonly (readonly [string, string])[];
}

/** Segments of a word: its explicit `furigana` data when present, otherwise `alignFurigana`. */
export function furiganaParts(word: RenderableWord & { kanji: string }): FuriganaPart[] {
  if (word.furigana && word.furigana.length > 0) {
    return word.furigana.map(([text, reading]): FuriganaPart => (reading === '' ? { type: 'kana', text } : { type: 'kanji', base: text, reading }));
  }
  return alignFurigana(word.kanji, word.kana);
}

/** SRS stage from which furigana is no longer shown (Guru). */
export const FURIGANA_HIDDEN_STAGE = 5;

const LONG_MARK = 'ー';

function romajiRun(source: string): string {
  // wanakana drops a っ that has no consonant to double (end of the run, before a vowel): spell it out instead
  source = source.replace(/[っッ](?=[あいうえおアイウエオ]|$)/g, 'xtsu');
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
  if (last && segment.type !== 'ruby' && segment.type !== 'kanaRuby' && last.type === segment.type) {
    last.text += segment.text;
  } else {
    segments.push(segment);
  }
}

const SMALL_KANA = new Set('ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ');

/** A unit (single kana or digraph) is known when the set holds it whole or every one of its characters. */
const unitKnown = (unit: string, known: ReadonlySet<string>): boolean =>
  known.has(unit) || (Array.from(unit).length > 1 && Array.from(unit).every((c) => known.has(c)));

/** How a kana unit is shown: itself, its hiragana when only that is known (katakana), or undefined (-> romaji). */
function readableForm(unit: string, known: ReadonlySet<string>): string | undefined {
  if (unitKnown(unit, known)) return unit;
  const hiragana = toHiragana(unit);
  return hiragana !== unit && unitKnown(hiragana, known) ? hiragana : undefined;
}

/**
 * Renders a kana string for the learner: known kana stay as they are, unknown
 * katakana falls back to the equivalent hiragana, and anything still unknown
 * becomes romaji. Non-kana characters pass through untouched.
 */
export function renderKana(text: string, knownKana: ReadonlySet<string>, mode: RomajiMode = 'ruby'): Segment[] {
  return mode === 'ruby' ? renderKanaRuby(text, knownKana) : renderKanaInline(text, knownKana);
}

type Piece = { unit: string } | { other: string };

/** Splits into kana units (yoon digraphs kept together, as `splitKanaUnits` does) keeping every other character. */
function splitPieces(text: string): Piece[] {
  const chars = Array.from(text);
  const pieces: Piece[] = [];
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]!;
    if (!(isHiragana(char) || isKatakana(char)) || char === LONG_MARK) {
      pieces.push({ other: char });
      continue;
    }
    const next = chars[i + 1];
    if (next && SMALL_KANA.has(next) && !SMALL_KANA.has(char)) {
      pieces.push({ unit: char + next });
      i++;
    } else {
      pieces.push({ unit: char });
    }
  }
  return pieces;
}

/** Romaji letter a locked っ/ッ stands for: the first consonant of the next unit (kk -> k, cchi -> t). */
function geminate(next: string | undefined): string {
  const r = next ? toRomaji(next) : '';
  if (r.startsWith('ch')) return 't';
  return /^[a-z]/.test(r) && !/^[aiueo]/.test(r) ? r[0]! : 'xtsu';
}

function renderKanaRuby(text: string, known: ReadonlySet<string>): Segment[] {
  const segments: Segment[] = [];
  const pieces = splitPieces(text);
  pieces.forEach((piece, i) => {
    if ('other' in piece) return void pushMerged(segments, { type: 'text', text: piece.other });
    const shown = readableForm(piece.unit, known);
    if (shown) return void pushMerged(segments, { type: 'text', text: shown });
    const kana = toHiragana(piece.unit);
    const nextPiece = pieces[i + 1];
    const nextUnit = nextPiece && 'unit' in nextPiece ? nextPiece.unit : undefined;
    const romaji = kana === 'っ' ? geminate(nextUnit) : toRomaji(kana);
    segments.push({ type: 'kanaRuby', kana, romaji });
  });
  return segments;
}

function renderKanaInline(text: string, knownKana: ReadonlySet<string>): Segment[] {
  const segments: Segment[] = [];
  let pendingRomaji = '';
  let forceNext = false;

  const flush = () => {
    if (pendingRomaji) pushMerged(segments, { type: 'romaji', text: romajiRun(pendingRomaji) });
    pendingRomaji = '';
  };

  const pieces = splitPieces(text);
  let lastWasKana = false;
  for (const piece of pieces) {
    if ('other' in piece) {
      const char = piece.other;
      if (char === LONG_MARK && lastWasKana) {
        if (pendingRomaji) pendingRomaji += char;
        else pushMerged(segments, { type: 'text', text: char });
        continue;
      }
      lastWasKana = false;
      forceNext = false;
      flush();
      pushMerged(segments, { type: 'text', text: char });
      continue;
    }
    lastWasKana = true;
    const shown = readableForm(piece.unit, knownKana);
    if (shown && !forceNext) {
      flush();
      pushMerged(segments, { type: 'text', text: shown });
    } else {
      pendingRomaji += piece.unit;
    }
    // a locked っ doubles the consonant of the next unit, so that unit must be romaji too
    forceNext = !shown && toHiragana(piece.unit) === 'っ';
  }
  flush();
  return segments;
}

/**
 * Core pedagogical rule: decides how a word is shown given what is unlocked.
 *  - unknown kana -> kana with romaji ruby (`ruby`, default) or inline romaji (`inline`); unlocked-less katakana -> its hiragana;
 *  - unlocked kanji -> kanji with `<ruby>` furigana;
 *  - kanji block whose characters are all at SRS stage >= Guru -> no furigana (furigana mode `auto`;
 *    `siempre` always shows them, `nunca` never);
 *  - kanji block with any locked character -> shown as its kana reading.
 */
export function renderPlan(word: RenderableWord, state: UnlockState, romajiMode: RomajiMode = 'ruby'): Segment[] {
  if (!word.kanji) return renderKana(word.kana, state.knownKana, romajiMode);

  const segments: Segment[] = [];
  const mode = state.furigana ?? 'auto';
  for (const part of furiganaParts({ ...word, kanji: word.kanji })) {
    if (part.type === 'kana') {
      for (const s of renderKana(part.text, state.knownKana, romajiMode)) pushMerged(segments, s);
      continue;
    }
    // 々 repeats the previous kanji, so it has no stage of its own
    const stages = [...part.base].filter((char) => isKanji(char) && char !== '々').map((char) => state.kanji.get(char));
    const unlocked = stages.every((stage) => stage !== undefined);
    if (!unlocked) {
      for (const s of renderKana(part.reading, state.knownKana, romajiMode)) pushMerged(segments, s);
    } else if (mode === 'nunca' || (mode === 'auto' && stages.every((stage) => stage! >= FURIGANA_HIDDEN_STAGE))) {
      pushMerged(segments, { type: 'text', text: part.base });
    } else {
      // furigana cannot hold nested ruby: its unknown kana are always inline romaji
      const reading = renderKana(part.reading, state.knownKana, 'inline')
        .map((s) => (s.type === 'ruby' ? s.base : s.type === 'kanaRuby' ? s.kana : s.text))
        .join('');
      segments.push({ type: 'ruby', base: part.base, reading });
    }
  }
  return segments;
}
