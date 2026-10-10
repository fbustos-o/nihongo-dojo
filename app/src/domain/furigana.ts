import { isKanji } from 'wanakana';

/** A chunk of a written word: kanji with its reading, or plain kana (okurigana etc.). */
export type FuriganaPart =
  | { type: 'kanji'; base: string; reading: string }
  | { type: 'kana'; text: string };

/**
 * Aligns a kanji spelling with its kana reading by stripping the shared kana
 * prefix and suffix (okurigana); whatever remains in the middle is one kanji
 * block carrying the rest of the reading.
 *
 *   食べる / たべる  -> 食(た) + べる
 *   お金 / おかね    -> お + 金(かね)
 *
 * Limits: the block between the prefix and suffix gets a single reading, so
 * kana embedded between two kanji (持ち物 / もちもの) yields one ruby over the
 * whole 持ち物, and per-kanji readings (学生 -> 学(がく)生(せい)) are not split.
 * If the kana does not contain the kanji word's kana (inconsistent data), the
 * whole word is returned as a single block.
 */
export function alignFurigana(kanji: string, kana: string): FuriganaPart[] {
  const k = [...kanji];
  const r = [...kana];

  let start = 0;
  while (start < k.length && start < r.length && !isKanji(k[start]!) && k[start] === r[start]) {
    start += 1;
  }

  let endK = k.length;
  let endR = r.length;
  while (endK > start && endR > start && !isKanji(k[endK - 1]!) && k[endK - 1] === r[endR - 1]) {
    endK -= 1;
    endR -= 1;
  }

  const parts: FuriganaPart[] = [];
  if (start > 0) parts.push({ type: 'kana', text: k.slice(0, start).join('') });
  if (endK > start) {
    parts.push({
      type: 'kanji',
      base: k.slice(start, endK).join(''),
      reading: r.slice(start, endR).join(''),
    });
  }
  if (endK < k.length) parts.push({ type: 'kana', text: k.slice(endK).join('') });
  return parts;
}
