import { describe, expect, it } from 'vitest';
import {
  COUNTERS,
  readCounter,
  readCounterQuestion,
  readDate,
  readDayOfMonth,
  readDayOfWeek,
  readMonth,
  readNumber,
  readPrice,
  readTime,
  readYear,
} from './numbers';

const kana = (n: number) => readNumber(n).kana;

describe('readNumber', () => {
  it.each([
    [0, 'ぜろ'],
    [1, 'いち'],
    [2, 'に'],
    [3, 'さん'],
    [4, 'よん'],
    [5, 'ご'],
    [6, 'ろく'],
    [7, 'なな'],
    [8, 'はち'],
    [9, 'きゅう'],
    [10, 'じゅう'],
    [11, 'じゅういち'],
    [14, 'じゅうよん'],
    [17, 'じゅうなな'],
    [19, 'じゅうきゅう'],
    [20, 'にじゅう'],
    [21, 'にじゅういち'],
    [40, 'よんじゅう'],
    [70, 'ななじゅう'],
    [99, 'きゅうじゅうきゅう'],
    [100, 'ひゃく'],
    [101, 'ひゃくいち'],
    [200, 'にひゃく'],
    [300, 'さんびゃく'],
    [400, 'よんひゃく'],
    [500, 'ごひゃく'],
    [600, 'ろっぴゃく'],
    [700, 'ななひゃく'],
    [800, 'はっぴゃく'],
    [900, 'きゅうひゃく'],
    [999, 'きゅうひゃくきゅうじゅうきゅう'],
    [1000, 'せん'],
    [1001, 'せんいち'],
    [1100, 'せんひゃく'],
    [2000, 'にせん'],
    [3000, 'さんぜん'],
    [4000, 'よんせん'],
    [5000, 'ごせん'],
    [6000, 'ろくせん'],
    [7000, 'ななせん'],
    [8000, 'はっせん'],
    [9000, 'きゅうせん'],
    [3333, 'さんぜんさんびゃくさんじゅうさん'],
    [8888, 'はっせんはっぴゃくはちじゅうはち'],
    [10000, 'いちまん'],
    [10001, 'いちまんいち'],
    [11000, 'いちまんせん'],
    [20000, 'にまん'],
    [30000, 'さんまん'],
    [100000, 'じゅうまん'],
    [123456, 'じゅうにまんさんぜんよんひゃくごじゅうろく'],
    [1000000, 'ひゃくまん'],
    [3000000, 'さんびゃくまん'],
    [6000000, 'ろっぴゃくまん'],
    [8000000, 'はっぴゃくまん'],
    [10000000, 'いっせんまん'],
    [30000000, 'さんぜんまん'],
    [80000000, 'はっせんまん'],
    [99999999, 'きゅうせんきゅうひゃくきゅうじゅうきゅうまんきゅうせんきゅうひゃくきゅうじゅうきゅう'],
  ])('%i -> %s', (n, expected) => {
    expect(kana(n)).toBe(expected);
  });

  it('irregulars named in the plan', () => {
    expect(kana(300)).toContain('さんびゃく');
    expect(kana(600)).toContain('ろっぴゃく');
    expect(kana(800)).toContain('はっぴゃく');
    expect(kana(3000)).toContain('さんぜん');
    expect(kana(8000)).toContain('はっせん');
    expect(kana(1000)).toBe('せん');
    expect(kana(10000)).toBe('いちまん');
  });

  it('accepts alternatives', () => {
    expect(readNumber(0).alternatives).toEqual(['れい']);
    expect(readNumber(1000).alternatives).toContain('いっせん');
    expect(readNumber(7).alternatives).toEqual(['しち']);
    expect(readNumber(70).alternatives).toEqual(['しちじゅう']);
    expect(readNumber(1007).alternatives).toEqual(expect.arrayContaining(['いっせんなな', 'せんしち', 'いっせんしち']));
    expect(readNumber(4).alternatives).toEqual([]);
    expect(readNumber(5).alternatives).toEqual([]);
  });

  it('gives romaji', () => {
    expect(readNumber(300).romaji).toBe('sanbyaku');
    expect(readNumber(600).romaji).toBe('roppyaku');
    expect(readNumber(8000).romaji).toBe('hassen');
    expect(readNumber(10000).romaji).toBe('ichiman');
    expect(readNumber(0).romaji).toBe('zero');
  });

  it('rejects out-of-range or non-integer values', () => {
    expect(() => readNumber(-1)).toThrow(RangeError);
    expect(() => readNumber(100_000_000)).toThrow(RangeError);
    expect(() => readNumber(1.5)).toThrow(RangeError);
    expect(() => readNumber(NaN)).toThrow(RangeError);
  });

  it('never throws and is distinct over a big sample', () => {
    const seen = new Set<string>();
    for (let n = 0; n <= 20000; n++) seen.add(kana(n));
    expect(seen.size).toBe(20001);
  });
});

describe('readPrice', () => {
  it.each([
    [0, 'ぜろえん'],
    [1, 'いちえん'],
    [4, 'よえん'],
    [5, 'ごえん'],
    [7, 'ななえん'],
    [9, 'きゅうえん'],
    [10, 'じゅうえん'],
    [14, 'じゅうよえん'],
    [40, 'よんじゅうえん'],
    [100, 'ひゃくえん'],
    [300, 'さんびゃくえん'],
    [400, 'よんひゃくえん'],
    [600, 'ろっぴゃくえん'],
    [800, 'はっぴゃくえん'],
    [1000, 'せんえん'],
    [3000, 'さんぜんえん'],
    [8000, 'はっせんえん'],
    [10000, 'いちまんえん'],
    [15800, 'いちまんごせんはっぴゃくえん'],
    [120000, 'じゅうにまんえん'],
  ])('%i -> %s', (n, expected) => {
    expect(readPrice(n).kana).toBe(expected);
  });

  it('4 yen has the よん alternative; 7 yen has しち', () => {
    expect(readPrice(4).alternatives).toContain('よんえん');
    expect(readPrice(14).alternatives).toContain('じゅうよんえん');
    expect(readPrice(7).alternatives).toContain('しちえん');
    expect(readPrice(1000).alternatives).toContain('いっせんえん');
  });

  it('romaji', () => {
    expect(readPrice(300).romaji).toBe('sanbyakuen');
  });
});

describe('counters: tsu', () => {
  it.each([
    [1, 'ひとつ'],
    [2, 'ふたつ'],
    [3, 'みっつ'],
    [4, 'よっつ'],
    [5, 'いつつ'],
    [6, 'むっつ'],
    [7, 'ななつ'],
    [8, 'やっつ'],
    [9, 'ここのつ'],
    [10, 'とお'],
  ])('%i -> %s', (n, expected) => {
    expect(readCounter(n, 'tsu').kana).toBe(expected);
  });
  it('from 11 the plain number is used', () => {
    expect(readCounter(11, 'tsu').kana).toBe('じゅういち');
    expect(readCounter(12, 'tsu').kana).toBe('じゅうに');
  });
});

describe('counters: nin', () => {
  it.each([
    [1, 'ひとり'],
    [2, 'ふたり'],
    [3, 'さんにん'],
    [4, 'よにん'],
    [5, 'ごにん'],
    [6, 'ろくにん'],
    [7, 'ななにん'],
    [8, 'はちにん'],
    [9, 'きゅうにん'],
    [10, 'じゅうにん'],
    [11, 'じゅういちにん'],
    [12, 'じゅうににん'],
    [14, 'じゅうよにん'],
    [20, 'にじゅうにん'],
    [21, 'にじゅういちにん'],
    [100, 'ひゃくにん'],
  ])('%i -> %s', (n, expected) => {
    expect(readCounter(n, 'nin').kana).toBe(expected);
  });
  it('7 people accepts しちにん; question word', () => {
    expect(readCounter(7, 'nin').alternatives).toContain('しちにん');
    expect(readCounterQuestion('nin').kana).toBe('なんにん');
  });
});

describe('counters: kai (floors)', () => {
  it.each([
    [1, 'いっかい'],
    [2, 'にかい'],
    [3, 'さんがい'],
    [4, 'よんかい'],
    [5, 'ごかい'],
    [6, 'ろっかい'],
    [7, 'ななかい'],
    [8, 'はっかい'],
    [9, 'きゅうかい'],
    [10, 'じゅっかい'],
    [11, 'じゅういっかい'],
    [13, 'じゅうさんがい'],
    [20, 'にじゅっかい'],
    [23, 'にじゅうさんがい'],
    [100, 'ひゃっかい'],
  ])('%i -> %s', (n, expected) => {
    expect(readCounter(n, 'kai').kana).toBe(expected);
  });
  it('alternatives: はちかい, じっかい; question なんがい', () => {
    expect(readCounter(8, 'kai').alternatives).toContain('はちかい');
    expect(readCounter(10, 'kai').alternatives).toContain('じっかい');
    expect(readCounter(7, 'kai').alternatives).toContain('しちかい');
    expect(readCounterQuestion('kai').kana).toBe('なんがい');
  });
  it('回 (times) uses さんかい', () => {
    expect(readCounter(3, 'times').kana).toBe('さんかい');
    expect(readCounter(1, 'times').kana).toBe('いっかい');
    expect(readCounter(6, 'times').kana).toBe('ろっかい');
    expect(readCounter(8, 'times').kana).toBe('はっかい');
  });
});

describe('counters: sai (age)', () => {
  it.each([
    [1, 'いっさい'],
    [2, 'にさい'],
    [3, 'さんさい'],
    [4, 'よんさい'],
    [5, 'ごさい'],
    [6, 'ろくさい'],
    [7, 'ななさい'],
    [8, 'はっさい'],
    [9, 'きゅうさい'],
    [10, 'じゅっさい'],
    [11, 'じゅういっさい'],
    [18, 'じゅうはっさい'],
    [19, 'じゅうきゅうさい'],
    [20, 'にじゅっさい'],
    [21, 'にじゅういっさい'],
    [24, 'にじゅうよんさい'],
    [28, 'にじゅうはっさい'],
    [30, 'さんじゅっさい'],
    [100, 'ひゃくさい'],
  ])('%i -> %s', (n, expected) => {
    expect(readCounter(n, 'sai').kana).toBe(expected);
  });
  it('はたち is an alternative for 20; じっさい for 10', () => {
    expect(readCounter(20, 'sai').alternatives).toContain('はたち');
    expect(readCounter(10, 'sai').alternatives).toContain('じっさい');
    expect(readCounter(8, 'sai').alternatives).toContain('はちさい');
    expect(readCounter(19, 'sai').alternatives).not.toContain('はたち');
  });
  it('question word', () => {
    expect(readCounterQuestion('sai').kana).toBe('なんさい');
    expect(readCounterQuestion('sai').alternatives).toContain('おいくつ');
  });
});

describe('counters: hon / mai / fun / ji', () => {
  it.each([
    [1, 'いっぽん'],
    [2, 'にほん'],
    [3, 'さんぼん'],
    [4, 'よんほん'],
    [5, 'ごほん'],
    [6, 'ろっぽん'],
    [7, 'ななほん'],
    [8, 'はっぽん'],
    [9, 'きゅうほん'],
    [10, 'じゅっぽん'],
    [11, 'じゅういっぽん'],
    [20, 'にじゅっぽん'],
    [100, 'ひゃっぽん'],
    [300, 'さんびゃっぽん'],
    [600, 'ろっぴゃっぽん'],
    [800, 'はっぴゃっぽん'],
    [1000, 'せんぼん'],
  ])('hon %i -> %s', (n, expected) => {
    expect(readCounter(n, 'hon').kana).toBe(expected);
  });

  it.each([
    [1, 'いちまい'],
    [2, 'にまい'],
    [4, 'よんまい'],
    [7, 'ななまい'],
    [9, 'きゅうまい'],
    [10, 'じゅうまい'],
    [12, 'じゅうにまい'],
  ])('mai %i -> %s', (n, expected) => {
    expect(readCounter(n, 'mai').kana).toBe(expected);
  });

  it.each([
    [1, 'いっぷん'],
    [2, 'にふん'],
    [3, 'さんぷん'],
    [4, 'よんぷん'],
    [5, 'ごふん'],
    [6, 'ろっぷん'],
    [7, 'ななふん'],
    [8, 'はっぷん'],
    [9, 'きゅうふん'],
    [10, 'じゅっぷん'],
    [11, 'じゅういっぷん'],
    [12, 'じゅうにふん'],
    [13, 'じゅうさんぷん'],
    [14, 'じゅうよんぷん'],
    [15, 'じゅうごふん'],
    [16, 'じゅうろっぷん'],
    [17, 'じゅうななふん'],
    [18, 'じゅうはっぷん'],
    [19, 'じゅうきゅうふん'],
    [20, 'にじゅっぷん'],
    [25, 'にじゅうごふん'],
    [30, 'さんじゅっぷん'],
    [40, 'よんじゅっぷん'],
    [45, 'よんじゅうごふん'],
    [50, 'ごじゅっぷん'],
    [55, 'ごじゅうごふん'],
    [59, 'ごじゅうきゅうふん'],
    [60, 'ろくじゅっぷん'],
  ])('fun %i -> %s', (n, expected) => {
    expect(readCounter(n, 'fun').kana).toBe(expected);
  });

  it('fun alternatives', () => {
    expect(readCounter(10, 'fun').alternatives).toContain('じっぷん');
    expect(readCounter(20, 'fun').alternatives).toContain('にじっぷん');
    expect(readCounter(8, 'fun').alternatives).toContain('はちふん');
    expect(readCounter(7, 'fun').alternatives).toContain('しちふん');
    expect(readCounterQuestion('fun').kana).toBe('なんぷん');
  });

  it.each([
    [1, 'いちじ'],
    [2, 'にじ'],
    [3, 'さんじ'],
    [4, 'よじ'],
    [5, 'ごじ'],
    [6, 'ろくじ'],
    [7, 'しちじ'],
    [8, 'はちじ'],
    [9, 'くじ'],
    [10, 'じゅうじ'],
    [11, 'じゅういちじ'],
    [12, 'じゅうにじ'],
    [14, 'じゅうよじ'],
    [19, 'じゅうくじ'],
    [20, 'にじゅうじ'],
    [24, 'にじゅうよじ'],
  ])('ji %i -> %s', (n, expected) => {
    expect(readCounter(n, 'ji').kana).toBe(expected);
  });

  it('zero is れい for hours, ぜろ elsewhere', () => {
    expect(readCounter(0, 'ji').kana).toBe('れいじ');
    expect(readCounter(0, 'fun').kana).toBe('ぜろふん');
    expect(readCounter(0, 'nin').alternatives).toContain('れいにん');
  });

  it('question words', () => {
    expect(readCounterQuestion('ji').kana).toBe('なんじ');
    expect(readCounterQuestion('hon').kana).toBe('なんぼん');
    expect(readCounterQuestion('mai').kana).toBe('なんまい');
    expect(readCounterQuestion('tsu').kana).toBe('いくつ');
    expect(readCounterQuestion('times').kana).toBe('なんかい');
  });

  it('every counter reads 0..120 without throwing, with romaji', () => {
    for (const c of COUNTERS) {
      for (let n = 0; n <= 120; n++) {
        const r = readCounter(n, c);
        expect(r.kana.length).toBeGreaterThan(0);
        expect(r.romaji).toMatch(/^[a-z']+$/);
        expect(r.alternatives).not.toContain(r.kana);
      }
    }
  });
});

describe('readTime', () => {
  it.each([
    [1, 0, 'いちじ'],
    [2, 0, 'にじ'],
    [3, 0, 'さんじ'],
    [4, 0, 'よじ'],
    [5, 0, 'ごじ'],
    [6, 0, 'ろくじ'],
    [7, 0, 'しちじ'],
    [8, 0, 'はちじ'],
    [9, 0, 'くじ'],
    [10, 0, 'じゅうじ'],
    [11, 0, 'じゅういちじ'],
    [12, 0, 'じゅうにじ'],
    [13, 0, 'じゅうさんじ'],
    [0, 0, 'れいじ'],
    [3, 30, 'さんじはん'],
    [7, 30, 'しちじはん'],
    [9, 30, 'くじはん'],
    [4, 1, 'よじいっぷん'],
    [4, 2, 'よじにふん'],
    [4, 3, 'よじさんぷん'],
    [4, 4, 'よじよんぷん'],
    [4, 5, 'よじごふん'],
    [4, 6, 'よじろっぷん'],
    [4, 7, 'よじななふん'],
    [4, 8, 'よじはっぷん'],
    [4, 9, 'よじきゅうふん'],
    [4, 10, 'よじじゅっぷん'],
    [7, 15, 'しちじじゅうごふん'],
    [9, 25, 'くじにじゅうごふん'],
    [12, 45, 'じゅうにじよんじゅうごふん'],
    [8, 20, 'はちじにじゅっぷん'],
    [10, 59, 'じゅうじごじゅうきゅうふん'],
  ])('%i:%i -> %s', (h, m, expected) => {
    expect(readTime(h, m).kana).toBe(expected);
  });

  it('half past has full-minute alternatives', () => {
    const t = readTime(3, 30);
    expect(t.alternatives).toEqual(expect.arrayContaining(['さんじさんじゅっぷん', 'さんじさんじっぷん']));
  });

  it('じっぷん alternative', () => {
    expect(readTime(4, 10).alternatives).toContain('よじじっぷん');
  });

  it('ごぜん / ごご', () => {
    expect(readTime(9, 0, { ampm: true }).kana).toBe('ごぜんくじ');
    expect(readTime(15, 30, { ampm: true }).kana).toBe('ごごさんじはん');
    expect(readTime(12, 0, { ampm: true }).kana).toBe('ごごじゅうにじ');
    expect(readTime(0, 0, { ampm: true }).kana).toBe('ごぜんれいじ');
    expect(readTime(23, 5, { ampm: true }).kana).toBe('ごごじゅういちじごふん');
    expect(readTime(4, 0, { ampm: true }).kana).toBe('ごぜんよじ');
  });

  it('romaji and validation', () => {
    expect(readTime(4, 30).romaji).toBe('yojihan');
    expect(readTime(9, 0).romaji).toBe('kuji');
    expect(() => readTime(24, 0)).toThrow(RangeError);
    expect(() => readTime(3, 60)).toThrow(RangeError);
    expect(() => readTime(3, -1)).toThrow(RangeError);
  });
});

describe('dates', () => {
  it.each([
    [1, 'いちがつ'],
    [2, 'にがつ'],
    [3, 'さんがつ'],
    [4, 'しがつ'],
    [5, 'ごがつ'],
    [6, 'ろくがつ'],
    [7, 'しちがつ'],
    [8, 'はちがつ'],
    [9, 'くがつ'],
    [10, 'じゅうがつ'],
    [11, 'じゅういちがつ'],
    [12, 'じゅうにがつ'],
  ])('month %i -> %s', (m, expected) => {
    expect(readMonth(m).kana).toBe(expected);
  });

  it('July accepts なながつ', () => {
    expect(readMonth(7).alternatives).toEqual(['なながつ']);
  });

  it.each([
    [1, 'ついたち'],
    [2, 'ふつか'],
    [3, 'みっか'],
    [4, 'よっか'],
    [5, 'いつか'],
    [6, 'むいか'],
    [7, 'なのか'],
    [8, 'ようか'],
    [9, 'ここのか'],
    [10, 'とおか'],
    [11, 'じゅういちにち'],
    [12, 'じゅうににち'],
    [13, 'じゅうさんにち'],
    [14, 'じゅうよっか'],
    [15, 'じゅうごにち'],
    [16, 'じゅうろくにち'],
    [17, 'じゅうしちにち'],
    [18, 'じゅうはちにち'],
    [19, 'じゅうくにち'],
    [20, 'はつか'],
    [21, 'にじゅういちにち'],
    [22, 'にじゅうににち'],
    [23, 'にじゅうさんにち'],
    [24, 'にじゅうよっか'],
    [25, 'にじゅうごにち'],
    [26, 'にじゅうろくにち'],
    [27, 'にじゅうしちにち'],
    [28, 'にじゅうはちにち'],
    [29, 'にじゅうくにち'],
    [30, 'さんじゅうにち'],
    [31, 'さんじゅういちにち'],
  ])('day %i -> %s', (d, expected) => {
    expect(readDayOfMonth(d).kana).toBe(expected);
  });

  it('17th/27th accept ななにち; 19th/29th accept きゅうにち', () => {
    expect(readDayOfMonth(17).alternatives).toEqual(['じゅうななにち']);
    expect(readDayOfMonth(27).alternatives).toEqual(['にじゅうななにち']);
    expect(readDayOfMonth(19).kana).toBe('じゅうくにち');
    expect(readDayOfMonth(19).alternatives).toEqual(['じゅうきゅうにち']);
    expect(readDayOfMonth(29).alternatives).toEqual(['にじゅうきゅうにち']);
    expect(readDayOfMonth(15).alternatives).toEqual([]);
  });

  it('readDate joins month and day', () => {
    expect(readDate(4, 1).kana).toBe('しがつついたち');
    expect(readDate(7, 7).kana).toBe('しちがつなのか');
    expect(readDate(9, 20).kana).toBe('くがつはつか');
    expect(readDate(12, 24).kana).toBe('じゅうにがつにじゅうよっか');
    expect(readDate(1, 31).kana).toBe('いちがつさんじゅういちにち');
    expect(readDate(7, 17).alternatives).toEqual(expect.arrayContaining(['しちがつじゅうななにち', 'なながつじゅうしちにち', 'なながつじゅうななにち']));
    expect(readDate(4, 1).month.kana).toBe('しがつ');
    expect(readDate(4, 1).day.kana).toBe('ついたち');
    expect(readDate(4, 1).romaji).toBe('shigatsutsuitachi');
  });

  it('validates the day against the month', () => {
    expect(() => readDate(2, 30)).toThrow(RangeError);
    expect(() => readDate(4, 31)).toThrow(RangeError);
    expect(() => readDate(13, 1)).toThrow(RangeError);
    expect(readDate(2, 29).kana).toBe('にがつにじゅうくにち');
  });

  it.each([
    [0, 'にちようび'],
    [1, 'げつようび'],
    [2, 'かようび'],
    [3, 'すいようび'],
    [4, 'もくようび'],
    [5, 'きんようび'],
    [6, 'どようび'],
  ])('weekday %i -> %s', (d, expected) => {
    expect(readDayOfWeek(d).kana).toBe(expected);
  });

  it('weekday validation', () => {
    expect(() => readDayOfWeek(7)).toThrow(RangeError);
    expect(readDayOfWeek(1).romaji).toBe('getsuyoubi');
  });
});

describe('readYear', () => {
  it.each([
    [1, 'いちねん'],
    [4, 'よねん'],
    [7, 'ななねん'],
    [9, 'きゅうねん'],
    [14, 'じゅうよねん'],
    [1999, 'せんきゅうひゃくきゅうじゅうきゅうねん'],
    [2000, 'にせんねん'],
    [2004, 'にせんよねん'],
    [2024, 'にせんにじゅうよねん'],
    [2025, 'にせんにじゅうごねん'],
    [1900, 'せんきゅうひゃくねん'],
  ])('%i -> %s', (y, expected) => {
    expect(readYear(y).kana).toBe(expected);
  });

  it('よんねん is an alternative; 1999 accepts いっせん', () => {
    expect(readYear(2004).alternatives).toContain('にせんよんねん');
    expect(readYear(1999).alternatives).toContain('いっせんきゅうひゃくきゅうじゅうきゅうねん');
  });

  it('validation', () => {
    expect(() => readYear(0)).toThrow(RangeError);
    expect(() => readYear(10000)).toThrow(RangeError);
  });
});
