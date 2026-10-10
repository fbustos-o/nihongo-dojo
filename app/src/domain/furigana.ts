import { isKanji } from 'wanakana';

/** A chunk of a written word: kanji with its reading, or plain kana (okurigana etc.). */
export type FuriganaPart =
  | { type: 'kanji'; base: string; reading: string }
  | { type: 'kana'; text: string };

/**
 * Aligns a kanji spelling with its kana reading. Kana inside the spelling (okurigana, particles,
 * prefixes) must appear literally in the reading; every run of kanji gets the stretch of reading
 * between them (shortest first, with backtracking).
 *
 *   食べる / たべる     -> 食(た) + べる
 *   お金 / おかね       -> お + 金(かね)
 *   持ち物 / もちもの   -> 持(も) + ち + 物(もの)
 *   学生 / がくせい     -> 学生(がくせい)   (per-kanji readings need explicit `Word.furigana`)
 *   今日 / きょう       -> 今日(きょう)     (jukugo: one ruby over the whole word)
 *
 * If the kana does not contain the spelling's kana (inconsistent data), the whole word is returned
 * as a single block. The text of all parts re-joins to the reading (verified over the vocabulary).
 */
export function alignFurigana(kanji: string, kana: string): FuriganaPart[] {
  // runs of kanji (incl. 々) alternate with runs of other characters
  const runs: { kanji: boolean; text: string[] }[] = [];
  for (const ch of kanji) {
    const isK = isKanji(ch);
    const last = runs.at(-1);
    if (last && last.kanji === isK) last.text.push(ch);
    else runs.push({ kanji: isK, text: [ch] });
  }
  const r = [...kana];

  const solve = (runIndex: number, pos: number): FuriganaPart[] | null => {
    if (runIndex === runs.length) return pos === r.length ? [] : null;
    const run = runs[runIndex]!;
    if (!run.kanji) {
      const literal = run.text;
      if (literal.some((ch, i) => r[pos + i] !== ch)) return null;
      const rest = solve(runIndex + 1, pos + literal.length);
      return rest && [{ type: 'kana', text: literal.join('') }, ...rest];
    }
    const isLast = runIndex === runs.length - 1;
    if (isLast) {
      if (pos >= r.length) return null;
      return [{ type: 'kanji', base: run.text.join(''), reading: r.slice(pos).join('') }];
    }
    for (let end = pos + 1; end <= r.length; end++) {
      const rest = solve(runIndex + 1, end);
      if (rest) return [{ type: 'kanji', base: run.text.join(''), reading: r.slice(pos, end).join('') }, ...rest];
    }
    return null;
  };

  return solve(0, 0) ?? [{ type: 'kanji', base: kanji, reading: kana }];
}
