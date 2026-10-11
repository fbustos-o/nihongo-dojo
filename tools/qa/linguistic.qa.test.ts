/**
 * QA E8/Q1 — linguistic audit (content + engines vs the teacher's sheets and Genki).
 * Run: cd app && npm run test:qa
 * Tests named "QA-xxx" that document a real bug are marked `it.fails` (they pass while the bug exists).
 */
import { toHiragana } from 'wanakana';
import { conjugateVerb, type VerbGroup } from '../../app/src/engine/conjugate';
import { conjugateIAdjective } from '../../app/src/engine/adjectives';
import { readCounter, readDate, readDayOfMonth, readMonth, readNumber, readPrice, readTime } from '../../app/src/engine/numbers';
import vocab from '../../app/src/content/vocab.json';
import patterns from '../../app/src/content/patterns.json';
import dialogues from '../../app/src/content/dialogues.json';
import kanji from '../../app/src/content/kanji.json';

type W = { id: string; kana: string; kanji?: string; romaji: string; es: string[]; pos: string; verbGroup?: VerbGroup; lesson: string };
const words = vocab as W[];
const byKana = (k: string) => words.filter((w) => w.kana === k);
const h = (romaji: string) => toHiragana(romaji.replace(/-/g, '').replace(/ /g, ''));

// ---------------------------------------------------------------------------------------------
// Teacher's conjugation tables (photos 20261010_144126 … 144349), transcribed as romaji.
// [dictionary, group, masu-stem, te]
// ---------------------------------------------------------------------------------------------
const TEACHER_VERBS: [string, VerbGroup, string, string][] = [
  ['かく', 'u', 'kaki', 'kaite'], ['ふく', 'u', 'fuki', 'fuite'], ['いく', 'u', 'iki', 'itte'], ['およぐ', 'u', 'oyogi', 'oyoide'],
  ['いそぐ', 'u', 'isogi', 'isoide'], ['てつだう', 'u', 'tetsudai', 'tetsudatte'], ['あらう', 'u', 'arai', 'aratte'], ['まつ', 'u', 'machi', 'matte'],
  ['もつ', 'u', 'mochi', 'motte'], ['おわる', 'u', 'owari', 'owatte'], ['のる', 'u', 'nori', 'notte'], ['まがる', 'u', 'magari', 'magatte'],
  ['すわる', 'u', 'suwari', 'suwatte'], ['かす', 'u', 'kashi', 'kashite'], ['はなす', 'u', 'hanashi', 'hanashite'], ['よむ', 'u', 'yomi', 'yonde'],
  ['のむ', 'u', 'nomi', 'nonde'], ['すむ', 'u', 'sumi', 'sunde'], ['あそぶ', 'u', 'asobi', 'asonde'], ['えらぶ', 'u', 'erabi', 'erande'],
  ['あける', 'ru', 'ake', 'akete'], ['しめる', 'ru', 'shime', 'shimete'], ['たべる', 'ru', 'tabe', 'tabete'], ['みせる', 'ru', 'mise', 'misete'],
  ['つける', 'ru', 'tsuke', 'tsukete'], ['みる', 'ru', 'mi', 'mite'], ['おきる', 'ru', 'oki', 'okite'], ['くる', 'irregular', 'ki', 'kite'],
  ['する', 'irregular', 'shi', 'shite'],
  // masu table (144126) and ています / ましょうか / たい tables
  ['あるく', 'u', 'aruki', 'aruite'], ['きく', 'u', 'kiki', 'kiite'], ['かう', 'u', 'kai', 'katte'], ['あう', 'u', 'ai', 'atte'],
  ['つかう', 'u', 'tsukai', 'tsukatte'], ['つくる', 'u', 'tsukuri', 'tsukutte'], ['かかる', 'u', 'kakari', 'kakatte'], ['いる', 'u', 'iri', 'itte'],
  ['けす', 'u', 'keshi', 'keshite'], ['やすむ', 'u', 'yasumi', 'yasunde'], ['はじめる', 'ru', 'hajime', 'hajimete'], ['ねる', 'ru', 'ne', 'nete'],
  ['とめる', 'ru', 'tome', 'tomete'], ['あたためる', 'ru', 'atatame', 'atatamete'], ['かりる', 'ru', 'kari', 'karite'], ['いる', 'ru', 'i', 'ite'],
  ['あげる', 'ru', 'age', 'agete'], ['ぬれる', 'ru', 'nure', 'nurete'], ['にる', 'ru', 'ni', 'nite'],
];

describe('conjugateVerb vs the teacher tables', () => {
  for (const [dict, group, stem, te] of TEACHER_VERBS) {
    it(`${dict} (${group})`, () => {
      const f = conjugateVerb(dict, group);
      expect(f.masu.kana).toBe(h(`${stem}masu`));
      expect(f.mashita.kana).toBe(h(`${stem}mashita`));
      expect(f.masen.kana).toBe(h(`${stem}masen`));
      expect(f.masendeshita.kana).toBe(h(`${stem}masendeshita`));
      expect(f.mashou.kana).toBe(h(`${stem}mashou`));
      expect(f.mashouka.kana).toBe(h(`${stem}mashouka`));
      expect(f.taidesu.kana).toBe(h(`${stem}taidesu`));
      expect(f.te.kana).toBe(h(te));
      expect(f.tekudasai.kana).toBe(h(`${te}kudasai`));
      expect(f.teimasu.kana).toBe(h(`${te}imasu`));
    });
    it(`${dict}: the vocabulary has it with group ${group}`, () => {
      const entries = byKana(dict).filter((w) => w.pos === 'verb');
      expect(entries.map((w) => w.verbGroup)).toContain(group);
    });
  }
});

// Teacher's い-adjective table (photo 144252): 29 adjectives + the たい suffix.
const TEACHER_IADJ = ['すばらしい', 'おもしろい', 'あまい', 'からい', 'かわいい', 'いそがしい', 'あつい', 'さむい', 'つめたい', 'すずしい', 'あたたかい', 'おおきい', 'ちいさい', 'ちかい', 'とおい', 'あたらしい', 'ふるい', 'たかい', 'やすい', 'はやい', 'おそい', 'おいしい', 'うまい', 'いい', 'よろしい', 'わるい', 'すごい', 'ない', 'ほしい'];
describe('conjugateIAdjective vs the teacher table', () => {
  it.fails('QA-004: かわいい conjugates as かわいかったです / かわいくないです (not かわよ-)', () => {
    const f = conjugateIAdjective('かわいい');
    expect([f.past.kana, f.negative.kana]).toEqual(['かわいかったです', 'かわいくないです']);
  });
  for (const a of TEACHER_IADJ.filter((x) => x !== 'かわいい')) {
    it(a, () => {
      const stem = a === 'いい' ? 'よ' : a.slice(0, -1);
      const f = conjugateIAdjective(a);
      expect(f.present.kana).toBe(`${a}です`);
      expect(f.past.kana).toBe(`${stem}かったです`);
      expect(f.negative.kana).toBe(`${stem}くないです`);
      expect(f.negativePast.kana).toBe(`${stem}くなかったです`);
      expect(words.some((w) => w.kana === a && w.pos === 'i-adj')).toBe(true);
    });
  }
});

describe('verb groups in vocab.json (tricky ones)', () => {
  // group-I verbs that look like ru-verbs, and genuine ru-verbs
  const GODAN_ERU_IRU = ['かえる', 'はいる', 'はしる', 'しる', 'きる-cortar', 'いる-necesitar', 'しゃべる', 'へる', 'まいる', 'にぎる', 'ける', 'すべる', 'かぎる'];
  it('every verb has a group and plain-looking -eru/-iru verbs that are group I are tagged u', () => {
    for (const w of words.filter((x) => x.pos === 'verb')) {
      expect(w.verbGroup, w.id).toBeDefined();
      const base = w.kana.split('を').at(-1)!;
      if (GODAN_ERU_IRU.some((g) => g.split('-')[0] === base) && w.id !== 'iru') expect(w.verbGroup, w.id).toBe('u');
    }
    expect(words.find((w) => w.id === 'iru')!.verbGroup).toBe('ru');
    expect(words.find((w) => w.id === 'iru-necesitar')!.verbGroup).toBe('u');
  });
  it('irregular verbs end in する / くる', () => {
    for (const w of words.filter((x) => x.verbGroup === 'irregular')) expect(/(する|くる)$/.test(w.kana), w.id).toBe(true);
  });
});

describe('numbers, time, dates, counters (teacher "Language Focus" sheets + Genki p. 37-38)', () => {
  it.each([
    [0, 'ぜろ'], [4, 'よん'], [7, 'なな'], [9, 'きゅう'], [14, 'じゅうよん'], [40, 'よんじゅう'], [100, 'ひゃく'], [300, 'さんびゃく'], [400, 'よんひゃく'],
    [600, 'ろっぴゃく'], [700, 'ななひゃく'], [800, 'はっぴゃく'], [1000, 'せん'], [3000, 'さんぜん'], [8000, 'はっせん'], [10000, 'いちまん'],
    [100000, 'じゅうまん'], [1500, 'せんごひゃく'], [15000, 'いちまんごせん'], [3600, 'さんぜんろっぴゃく'],
  ])('readNumber(%i) = %s', (n, k) => expect(readNumber(n).kana).toBe(k));
  it('prices', () => {
    expect(readPrice(4).kana).toBe('よえん');
    expect(readPrice(400).kana).toBe('よんひゃくえん');
    expect(readPrice(20000).kana).toBe('にまんえん');
  });
  it.each([
    [4, 0, 'よじ'], [7, 0, 'しちじ'], [9, 0, 'くじ'], [2, 30, 'にじはん'], [1, 1, 'いちじいっぷん'], [3, 3, 'さんじさんぷん'], [4, 4, 'よじよんぷん'],
    [6, 6, 'ろくじろっぷん'], [8, 8, 'はちじはっぷん'], [10, 10, 'じゅうじじゅっぷん'], [12, 20, 'じゅうにじにじゅっぷん'], [11, 15, 'じゅういちじじゅうごふん'],
  ])('readTime(%i, %i) = %s', (hh, mm, k) => expect(readTime(hh, mm).kana).toBe(k));
  it('time alternatives accepted (じっぷん, さんじゅっぷん for はん, ななふん)', () => {
    expect(readTime(10, 10).alternatives).toContain('じゅうじじっぷん');
    expect(readTime(2, 30).alternatives).toContain('にじさんじゅっぷん');
    expect(readTime(1, 7).alternatives).toContain('いちじしちふん');
  });
  it.each([
    [1, 'ついたち'], [2, 'ふつか'], [3, 'みっか'], [4, 'よっか'], [5, 'いつか'], [6, 'むいか'], [7, 'なのか'], [8, 'ようか'], [9, 'ここのか'], [10, 'とおか'],
    [11, 'じゅういちにち'], [14, 'じゅうよっか'], [17, 'じゅうしちにち'], [19, 'じゅうくにち'], [20, 'はつか'], [24, 'にじゅうよっか'], [29, 'にじゅうくにち'], [30, 'さんじゅうにち'],
  ])('readDayOfMonth(%i) = %s', (d, k) => expect(readDayOfMonth(d).kana).toBe(k));
  it('months', () => {
    expect([4, 7, 9].map((m) => readMonth(m).kana)).toEqual(['しがつ', 'しちがつ', 'くがつ']);
    expect(readDate(7, 20).kana).toBe('しちがつはつか');
  });
  it.each([
    ['tsu', 1, 'ひとつ'], ['tsu', 4, 'よっつ'], ['tsu', 10, 'とお'], ['nin', 1, 'ひとり'], ['nin', 2, 'ふたり'], ['nin', 4, 'よにん'], ['nin', 7, 'ななにん'],
    ['kai', 1, 'いっかい'], ['kai', 3, 'さんがい'], ['kai', 6, 'ろっかい'], ['kai', 8, 'はっかい'], ['kai', 10, 'じゅっかい'], ['sai', 1, 'いっさい'],
    ['sai', 8, 'はっさい'], ['sai', 10, 'じゅっさい'], ['sai', 20, 'はたち'],
  ] as const)('readCounter(%s, %i) = %s', (c, n, k) => expect(readCounter(n, c).kana).toBe(k));
  it('vocab numbers agree with the engine', () => {
    for (const [id, n] of [['sanbyaku', 300], ['sanzen', 3000], ['ichiman', 10000], ['hyaku', 100]] as const) expect(words.find((w) => w.id === id)!.kana).toBe(readNumber(n).kana);
  });
});

// ---------------------------------------------------------------------------------------------
// Content-quality findings (each it.fails documents a real error to fix in the generators)
// ---------------------------------------------------------------------------------------------
describe('vocab.json data quality', () => {
  it.fails('QA-020: no Spanish gloss is cut inside parentheses (split on ";" in build_vocab.py)', () => {
    const broken = words.filter((w) => w.es.some((e) => (e.match(/\(/g) ?? []).length !== (e.match(/\)/g) ?? []).length)).map((w) => `${w.id}: ${w.es.join(' | ')}`);
    expect(broken).toEqual([]);
  });
  it.fails('QA-021: no English / internal notes in Spanish glosses', () => {
    expect(words.filter((w) => w.es.some((e) => /teacher|TODO|\?\?/i.test(e))).map((w) => `${w.id}: ${w.es.join(' | ')}`)).toEqual([]);
  });
  it.fails('QA-022: Word.kana uses the natural syllabary (チリじん, not ちりじん)', () => {
    const chiri = words.find((w) => w.id === 'chirijin')!;
    expect(chiri.kana).toBe('チリじん');
  });
});

type Ex = { es: string; ja: string; romaji: string };
const allExamples = (patterns as { id: string; examples?: Ex[] }[]).flatMap((p) => (p.examples ?? []).map((e, i) => ({ ...e, id: `${p.id}:${i}` })));
const allLines = (dialogues as { id: string; lines: Ex[] }[]).flatMap((d) => d.lines.map((l, i) => ({ ...l, id: `${d.id}:${i}` })));

describe('patterns.json / dialogues.json', () => {
  it('229 examples and 19 dialogues', () => {
    expect(allExamples).toHaveLength(229);
    expect(dialogues).toHaveLength(19);
  });
  it.fails('QA-023: romaji writes the particle は as "wa" (not "ha")', () => {
    const bad = [...allExamples, ...allLines].filter((e) => /\b(?:\w+teha|ha)\b(?=[\s?.,]|$)/.test(e.romaji) && !/\bha(i|ji)/.test(e.romaji)).map((e) => `${e.id}: ${e.romaji}`);
    expect(bad).toEqual([]);
  });
  it.fails('QA-024: sentences do not contain inner punctuation that the syntax tokenizer glues to a word', () => {
    const bad = allExamples.filter((e) => /[、，,]/.test(e.ja.replace(/[。？！]$/, ''))).map((e) => `${e.id}: ${e.ja}`);
    expect(bad).toEqual([]);
  });
  it.fails('QA-025: papeleria line 2 uses は for the price question (その えんぴつ は いくら ですか)', () => {
    const line = (dialogues as { id: string; lines: Ex[] }[]).find((d) => d.id === 'papeleria')!.lines[2]!;
    expect(line.ja).toBe('その えんぴつ は いくら ですか？');
  });
  it('the kana of every example/line is written with known characters only (no kanji in stage-2 content)', () => {
    expect([...allExamples, ...allLines].filter((e) => /[一-鿿]/u.test(e.ja)).map((e) => e.id)).toEqual([]);
  });
});

describe('kanji.json spot checks (Genki I, pp. 「漢字表」 L3–L12)', () => {
  const K = kanji as { char: string; genkiLesson: number; on: string[]; kun: string[]; es: string[]; teach?: string[] }[];
  it('144 kanji, lesson counts as in Genki', () => {
    expect(K).toHaveLength(144);
    const counts = Object.fromEntries([3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((l) => [l, K.filter((k) => k.genkiLesson === l).length]));
    expect(counts).toEqual({ 3: 15, 4: 14, 5: 14, 6: 15, 7: 14, 8: 14, 9: 15, 10: 14, 11: 16, 12: 13 }); // 々 (L12) is not a kanji entry
  });
  it.each([
    ['日', 4, 'にち', 'ひ'], ['本', 4, 'ほん', 'もと'], ['人', 4, 'じん', 'ひと'], ['食', 5, 'しょく', 'たべる'], ['見', 5, 'けん', 'みる'],
    ['行', 5, 'こう', 'いく'], ['学', 6, 'がく', 'まなぶ'], ['会', 7, 'かい', 'あう'], ['読', 8, 'どく', 'よむ'], ['来', 9, 'らい', 'くる'],
    ['年', 10, 'ねん', 'とし'], ['強', 11, 'きょう', 'つよい'], ['起', 12, 'き', 'おきる'], ['毎', 7, 'まい', ''], ['円', 3, 'えん', 'まるい'],
  ])('%s: lesson %i, readings %s / %s', (ch, lesson, on, kun) => {
    const k = K.find((x) => x.char === ch)!;
    expect(k.genkiLesson).toBe(lesson);
    expect(k.on).toContain(on);
    if (kun) expect(k.kun.map((r) => r.replace(/[()\-.]/g, ''))).toContain(kun);
  });
});
