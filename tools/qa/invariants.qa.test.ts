/**
 * QA E8/Q1 — pedagogical invariants at the content / renderPlan / game-logic level, and answer fairness.
 * Run: cd app && npm run test:qa       (prints the pool report of all 66 lessons with --reporter=verbose)
 * `it.fails` = documents a real bug (passes while the bug exists; flips to a failure once fixed).
 */
import { content } from '../../app/src/domain/contentLoader';
import { renderKana, renderPlan } from '../../app/src/domain/renderPlan';
import { checkAnswer } from '../../app/src/engine/answer';
import { lessonContent, roundsFor } from '../../app/src/lesson/lessonLogic';
import { unlockedKanaForLessons } from '../../app/src/engine/kanaFilter';
import { kanaChoices, judgeRomaji, knownKanaPool, writePrompt } from '../../app/src/games/kanaUtils';
import { meaningChoices } from '../../app/src/games/wordUtils';
import { isValidOrder, syntaxEntries, tokenize } from '../../app/src/games/syntax/syntaxLogic';
import { particleEntries, particleOptions } from '../../app/src/games/particles/particleLogic';
import { makeReadingText } from '../../app/src/games/mini-reading/readingLogic';
import { cappedRounds, eligibleDialogues } from '../../app/src/games/dialogues/dialoguesLogic';
import { gameHasMaterial, scopedDialogues, scopedPatterns } from '../../app/src/games/lessonScope';
import { conjugableWords, formsForLesson, CATEGORIES } from '../../app/src/games/conjugation/conjugationLogic';
import type { Lesson } from '../../app/src/domain/schema';

const { curriculum, kana, vocab, patterns, dialogues } = content;
const byId = new Map(curriculum.map((l) => [l.id, l]));
function ancestors(l: Lesson): string[] {
  const seen = new Set<string>();
  const visit = (x: Lesson) => x.requires.forEach((r) => { if (!seen.has(r)) { seen.add(r); visit(byId.get(r)!); } });
  visit(l);
  return [...seen];
}
const knownBefore = (l: Lesson) => unlockedKanaForLessons(curriculum, ancestors(l));

describe('renderPlan: only unlocked kana are shown', () => {
  const allHiragana = new Set(curriculum.filter((l) => l.stage === 1).flatMap((l) => l.kana ?? []));
  it('QA-001: yōon unlocked as digraphs (きゃ) render as kana, not «きyaく»', () => {
    const segs = renderKana('きゃく', allHiragana);
    expect(segs).toEqual([{ type: 'text', text: 'きゃく' }]);
  });
  it('QA-001b: every stage-1 word renders without romaji once stage 1 is complete', () => {
    const mixed = vocab.filter((w) => !/[ァ-ヺ]/.test(w.kana)).filter((w) => renderPlan({ kana: w.kana }, { knownKana: allHiragana, kanji: new Map() }).some((s) => s.type === 'romaji'));
    expect(mixed.map((w) => w.kana)).toEqual([]);
  });
  it('locked katakana falls back to hiragana in stage 2', () => {
    expect(renderKana('コーヒー', allHiragana)).toEqual([{ type: 'text', text: 'こーひー' }]);
  });
  it('kanji: locked -> reading, unlocked -> ruby, Guru -> plain; siempre / nunca', () => {
    const w = { kana: 'たべる', kanji: '食べる' };
    const st = (stage: number | undefined, furigana: 'auto' | 'siempre' | 'nunca' = 'auto') => ({ knownKana: allHiragana, kanji: new Map(stage === undefined ? [] : [['食', stage]]), furigana });
    expect(renderPlan(w, st(undefined))[0]).toEqual({ type: 'text', text: 'たべる' });
    expect(renderPlan(w, st(1))[0]).toEqual({ type: 'ruby', base: '食', reading: 'た' });
    expect(renderPlan(w, st(5))[0]).toEqual({ type: 'text', text: '食べる' });
    expect(renderPlan(w, st(5, 'siempre'))[0]).toMatchObject({ type: 'ruby' });
    expect(renderPlan(w, st(1, 'nunca'))[0]).toEqual({ type: 'text', text: '食べる' });
  });
});

describe('game content selection never shows locked kana', () => {
  it('QA-003: Listen distractors (kanaChoices over knownKanaPool, as Listen.tsx builds them) stay inside the known + lesson kana', () => {
    // Parte 1 probed kanaChoices() without the filter; the game now passes knownKanaPool(known, lesson). The game itself is
    // covered in tools/qa/q2.qa.test.tsx (renders <Listen>) and e2e/invariants.e2e.ts (QA-003).
    const lessonKana = new Set(['あ', 'い', 'う', 'え', 'お']);
    const pool = knownKanaPool([], lessonKana);
    const leaked = new Set<string>();
    for (const k of kana.filter((x) => lessonKana.has(x.char))) for (let i = 0; i < 30; i++) kanaChoices(k, 4, pool).forEach((c) => { if (!lessonKana.has(c.char)) leaked.add(c.char); });
    expect([...leaked]).toEqual([]);
  });
  it('QA-031: Spanish glosses shown in stage 1 contain no kana', () => {
    expect(vocab.filter((w) => w.es.some((e) => /[ぁ-ゖァ-ヺ]/u.test(e))).map((w) => `${w.id}: ${w.es.join(' / ')}`)).toEqual([]);
  });
  it('stage 1 and stage 3 lesson words are readable with known + lesson kana', () => {
    for (const l of curriculum.filter((x) => x.stage === 1 || x.stage === 3)) {
      const c = lessonContent(l, knownBefore(l), content);
      const known = new Set([...knownBefore(l), ...(l.kana ?? [])].flatMap((k) => [k, ...k]));
      for (const w of c.words) for (const ch of w.kana.replace(/[ー\s]/g, '')) expect(known.has(ch) || /[ゃゅょャュョァィゥェォ]/.test(ch), `${l.id}: ${w.kana}`).toBe(true);
    }
  });
});

// ------------------------------------------------------------------------------------------------
// Pool report for all 66 lessons
// ------------------------------------------------------------------------------------------------
interface PoolRow { lesson: string; game: string; pool: number; rounds: number; note: string }
const rows: PoolRow[] = [];
for (const l of curriculum) {
  const c = lessonContent(l, knownBefore(l), content);
  const own = patterns.filter((p) => l.patterns?.includes(p.id));
  // the same helpers the games use: own patterns, else the ancestors' (QA-015); lessons without material skip the game
  const lp = scopedPatterns(own, l.id, curriculum, patterns);
  const inherited = own.length === 0 && lp.length > 0;
  for (const g of l.games) {
    let rounds = g === 'kanji' ? Math.max(12, Math.min(24, c.kanji.length * 2)) : roundsFor(g.startsWith('kana-') ? c.kana.length : c.words.length);
    let pool = 0;
    let note = '';
    if (!gameHasMaterial(g, l, { curriculum, patterns, dialogues })) {
      rows.push({ lesson: l.id, game: g, pool: 0, rounds, note: 'sin material: el juego se omite en la lección' });
      continue;
    }
    switch (g) {
      case 'kana-recognize': case 'kana-write': pool = c.kana.length + (g === 'kana-write' ? c.words.length : 0); break;
      case 'read-words': pool = c.words.length; break;
      case 'listen': pool = c.kana.length + (c.words.length >= 2 ? c.words.length : 0); break;
      case 'syntax': pool = syntaxEntries(lp).length; if (inherited) note = 'patrones heredados de lecciones anteriores'; break;
      case 'particles': pool = particleEntries(lp).length; if (inherited) note = 'patrones heredados de lecciones anteriores'; break;
      case 'mini-reading': pool = lp.reduce((n, p) => n + (p.examples?.length ?? 0), 0); if (inherited) note = 'patrones heredados de lecciones anteriores'; break;
      case 'dialogues': {
        const d = scopedDialogues(dialogues, l.id, l.dialogues, curriculum);
        pool = d.reduce((n, x) => n + x.lines.filter((ln) => ln.speaker === 'B').length, 0);
        rounds = cappedRounds(rounds, d, 'B') ?? rounds;
        if (!l.dialogues?.length) note = `diálogos heredados: ${d.map((x) => x.id).join(',')}`;
        break;
      }
      case 'conjugation': {
        const forms = formsForLesson(l.id, lp.map((p) => p.id));
        const own = CATEGORIES.filter((k) => forms[k].length > 0).map((k) => [k, conjugableWords(c.words, k).length] as const);
        pool = own.reduce((n, [k, len]) => n + len * forms[k].length, 0);
        const fallback = own.filter(([, len]) => len === 0).map(([k]) => k);
        if (fallback.length) note = `sin palabras propias de ${fallback.join(',')}: usa TODO el vocabulario`;
        break;
      }
      case 'kanji': pool = c.kanji.length; break;
      default: pool = Infinity; note = 'preguntas aleatorias';
    }
    rows.push({ lesson: l.id, game: g, pool, rounds, note });
  }
}

describe('every lesson is playable (66 lessons)', () => {
  it('66 lessons, each with at least one game and a non-empty pool for every game', () => {
    expect(curriculum).toHaveLength(66);
    const empty = rows.filter((r) => r.pool === 0 && !r.note.startsWith('sin material'));
    expect(empty).toEqual([]);
  });
  it('report: thin pools (fewer distinct items than rounds) and fallbacks', () => {
    const thin = rows.filter((r) => r.note || (Number.isFinite(r.pool) && r.pool < r.rounds / 2));
    console.log(['lesson | game | pool | rounds | note', ...thin.map((r) => `${r.lesson} | ${r.game} | ${r.pool} | ${r.rounds} | ${r.note}`)].join('\n'));
    expect(thin.length).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------------------------------------------
// Grammar used before it is taught (syntax / particles / mini-reading / dialogues of each lesson)
// ------------------------------------------------------------------------------------------------
const GRAMMAR: [string, RegExp, string][] = [
  ['て-form', /(て|で)(、| ください| います| も いい|も いい|は いけません|ては)/u, 'l-te-kudasai'],
  ['past ました/でした/かった', /(ました|でした|かった)/u, 'l-conj-masu'],
  ['たい', /たい です|たく ない/u, 'l-te-imasu-tai'],
];
describe('grammar is not used before the lesson that teaches it', () => {
  const order = curriculum.map((l) => l.id);
  it('report: examples / dialogue lines that use grammar taught later', () => {
    const out: string[] = [];
    for (const l of curriculum) {
      const before = new Set([...ancestors(l), l.id]);
      const texts = [
        ...patterns.filter((p) => l.patterns?.includes(p.id)).flatMap((p) => (p.examples ?? []).map((e, i) => [`${p.id}:${i}`, e.ja] as const)),
        ...dialogues.filter((d) => l.dialogues?.includes(d.id)).flatMap((d) => d.lines.map((ln, i) => [`${d.id}:${i}`, ln.ja] as const)),
      ];
      for (const [name, re, teacher] of GRAMMAR) {
        if (before.has(teacher) || order.indexOf(teacher) < 0) continue;
        for (const [id, ja] of texts) if (re.test(ja)) out.push(`${l.id}: ${id} usa ${name} (se enseña en ${teacher}): ${ja}`);
      }
    }
    console.log(out.join('\n'));
    expect(Array.isArray(out)).toBe(true);
  });
});

describe('syntax / particles game logic', () => {
  it('QA-010: isValidOrder rejects moving an の-modifier away from its noun', () => {
    const sol = tokenize('つくえ の うえ に ほん が あります。');
    expect(isValidOrder(sol, tokenize('うえ に つくえ の ほん が あります'))).toBe(false);
  });
  it('QA-010b: isValidOrder rejects 「だれ の これ は かばん ですか」', () => {
    expect(isValidOrder(tokenize('これ は だれ の かばん ですか。'), tokenize('だれ の これ は かばん ですか'))).toBe(false);
  });
  it('accepts the free order of time/topic phrases (きのう わたし は … / わたし は きのう …)', () => {
    expect(isValidOrder(tokenize('わたし は としょかん で ほん を よみます'), tokenize('としょかん で わたし は ほん を よみます'))).toBe(true);
  });
  it('QA-024b: tiles never contain punctuation glued to a word (はい、がくせい)', () => {
    const glued = syntaxEntries(patterns).flatMap((e) => e.tokens.filter((t) => /[、，]/.test(t)).map((t) => `${e.id}: ${t}`));
    expect(glued).toEqual([]);
  });
  it('QA-011: particle distractors are never also correct (ともだち に/と あいます)', () => {
    let offered = false;
    for (let i = 0; i < 200; i++) if (particleOptions('に').includes('と')) offered = true;
    expect(offered).toBe(false);
  });
});

describe('answer checking fairness', () => {
  const ok = (input: string, expected: string, opts = {}) => checkAnswer(input, expected, opts).correct;
  it('spaces, long-vowel mark, sokuon, ん, script tolerance', () => {
    expect(ok('わたし は', 'わたしは')).toBe(true);
    expect(ok('ko-hi-', 'コーヒー')).toBe(true);
    expect(ok('koohii', 'コーヒー')).toBe(true);
    expect(ok('kouhii', 'コーヒー')).toBe(true);
    expect(ok('kitte', 'きって')).toBe(true);
    expect(ok("kin'en", 'きんえん')).toBe(true);
    expect(ok('がっこう', 'ガッコウ')).toBe(true);
    expect(ok('konnichiwa', 'こんにちは')).toBe(true);
    expect(ok('wa', 'は', { strict: true })).toBe(false);
  });
  it('QA-012: a whole sentence typed with わ / え for the particles is accepted outside the particle game (spaced sentences, as in the content)', () => {
    expect(ok('わたしわがくせいです', 'わたし は がくせい です')).toBe(true);
    expect(ok('がっこうえいきます', 'がっこう へ いきます')).toBe(true);
  });
  it('QA-013: kana-recognize accepts "nn" for ん and Kunrei romaji (si, ti, tu, hu, zi)', () => {
    const k = (c: string) => kana.find((x) => x.char === c)!;
    expect(['nn', 'si', 'ti', 'tu', 'hu', 'zi'].map((r, i) => judgeRomaji(r, k(['ん', 'し', 'ち', 'つ', 'ふ', 'じ'][i]!)))).toEqual(Array(6).fill('correct'));
  });
  it('QA-009: kana-write prompts are unambiguous: kana that share a romaji (を/お, ぢ/じ, づ/ず) get distinct prompts (writePrompt)', () => {
    // Parte 1 checked raw kana.json romaji collisions (still there, by design). What the game shows is writePrompt();
    // the rendered game is covered in tools/qa/q2.qa.test.tsx.
    const dup = ['hiragana', 'katakana'].flatMap((s) => {
      const list = kana.filter((x) => x.script === s && [...x.char].length === 1);
      return list.filter((a) => list.some((b) => b !== a && writePrompt(b).romaji === writePrompt(a).romaji)).map((a) => `${a.char}=${writePrompt(a).romaji}`);
    });
    expect(dup).toEqual([]);
  });
  it('QA-014: read-words never offers a distractor that is a meaning of a homophone (あつい: caluroso / caliente)', () => {
    const homophones = vocab.filter((w) => !w.kanji && vocab.some((o) => o !== w && o.kana === w.kana && !o.kanji));
    const bad: string[] = [];
    for (const w of homophones) for (let i = 0; i < 400; i++) {
      const others = vocab.filter((o) => o !== w && o.kana === w.kana).map((o) => o.es[0]);
      meaningChoices(w).forEach((c) => { if (!c.correct && others.includes(c.text)) bad.push(`${w.id}: ${c.text}`); });
    }
    expect([...new Set(bad)]).toEqual([]);
  });
});
