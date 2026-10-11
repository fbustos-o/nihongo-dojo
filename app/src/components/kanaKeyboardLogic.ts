export type KanaScript = 'hiragana' | 'katakana';

/** Gojūon rows (gyō), vowel order a i u e o. Empty string = no kana in that slot. */
export const GYO: readonly { label: string; kana: readonly string[] }[] = [
  { label: 'あ', kana: ['あ', 'い', 'う', 'え', 'お'] },
  { label: 'か', kana: ['か', 'き', 'く', 'け', 'こ'] },
  { label: 'さ', kana: ['さ', 'し', 'す', 'せ', 'そ'] },
  { label: 'た', kana: ['た', 'ち', 'つ', 'て', 'と'] },
  { label: 'な', kana: ['な', 'に', 'ぬ', 'ね', 'の'] },
  { label: 'は', kana: ['は', 'ひ', 'ふ', 'へ', 'ほ'] },
  { label: 'ま', kana: ['ま', 'み', 'む', 'め', 'も'] },
  { label: 'や', kana: ['や', '', 'ゆ', '', 'よ'] },
  { label: 'ら', kana: ['ら', 'り', 'る', 'れ', 'ろ'] },
  { label: 'わ', kana: ['わ', 'を', 'ん', '', ''] },
];

const HIRA_START = 0x3041;
const HIRA_END = 0x3096;

/** Hiragana -> katakana (same code point +0x60); anything else is left alone. */
export function toScript(char: string, script: KanaScript): string {
  if (script === 'hiragana') return char;
  return [...char]
    .map((c) => (c.charCodeAt(0) >= HIRA_START && c.charCodeAt(0) <= HIRA_END ? String.fromCharCode(c.charCodeAt(0) + 0x60) : c))
    .join('');
}

const isKata = (c: string): boolean => c >= 'ァ' && c <= 'ヶ';
const toHira = (c: string): string => (isKata(c) ? String.fromCharCode(c.charCodeAt(0) - 0x60) : c);
const back = (hira: string, kata: boolean): string => (kata ? toScript(hira, 'katakana') : hira);

const PLAIN = 'かきくけこさしすせそたちつてとはひふへほ';
const VOICED = 'がぎぐげござじずぜぞだぢづでどばびぶべぼ';
const SEMI = 'ぱぴぷぺぽ';
const HA = 'はひふへほ';
const BA = 'ばびぶべぼ';

/** Applies `fn` to the last character (as hiragana) and restores its script. */
function onLast(text: string, fn: (hira: string) => string): string {
  const chars = [...text];
  const last = chars.pop();
  if (last === undefined) return text;
  return chars.join('') + back(fn(toHira(last)), isKata(last));
}

/** Toggles ゛ on the last character: か⇄が, は⇄ば, ぱ→ば, う⇄ゔ (ウ⇄ヴ). Other characters are untouched. */
export function toggleDakuten(text: string): string {
  return onLast(text, (h) => {
    if (PLAIN.includes(h)) return VOICED[PLAIN.indexOf(h)]!;
    if (VOICED.includes(h)) return PLAIN[VOICED.indexOf(h)]!;
    if (SEMI.includes(h)) return BA[SEMI.indexOf(h)]!;
    if (h === 'う') return 'ゔ';
    if (h === 'ゔ') return 'う';
    return h;
  });
}

/** Toggles ゜ on the last character (は行 only): は⇄ぱ, ば→ぱ. */
export function toggleHandakuten(text: string): string {
  return onLast(text, (h) => {
    if (HA.includes(h)) return SEMI[HA.indexOf(h)]!;
    if (BA.includes(h)) return SEMI[BA.indexOf(h)]!;
    if (SEMI.includes(h)) return HA[SEMI.indexOf(h)]!;
    return h;
  });
}

const SMALL_PAIRS: readonly (readonly [string, string])[] = [
  ['つ', 'っ'], ['や', 'ゃ'], ['ゆ', 'ゅ'], ['よ', 'ょ'], ['わ', 'ゎ'],
  ['あ', 'ぁ'], ['い', 'ぃ'], ['う', 'ぅ'], ['え', 'ぇ'], ['お', 'ぉ'],
  ['か', 'ゕ'], ['け', 'ゖ'],
];

/** Toggles the small form of the last character: つ⇄っ, や⇄ゃ, あ⇄ぁ (katakana too: ツ⇄ッ, イ⇄ィ). */
export function toggleSmall(text: string): string {
  return onLast(text, (h) => {
    for (const [big, small] of SMALL_PAIRS) {
      if (h === big) return small;
      if (h === small) return big;
    }
    return h;
  });
}

/** Removes the last character (code-point aware). */
export const backspace = (text: string): string => [...text].slice(0, -1).join('');
