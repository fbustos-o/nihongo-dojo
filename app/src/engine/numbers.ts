import { allReadings, makeReading, type Reading } from './reading';

export type { Reading };

const ONES = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];

export const MAX_NUMBER = 99_999_999;

function assertInt(n: number, min: number, max: number, what: string): void {
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new RangeError(`${what} must be an integer between ${min} and ${max}: ${n}`);
  }
}

// ---------------------------------------------------------------------------
// Plain numbers
// ---------------------------------------------------------------------------

interface NumFlags {
  /** Read 7 as しち instead of なな. */
  shichi: boolean;
  /** Read a 1 in the thousands place as いっせん instead of せん. */
  issen: boolean;
  /** Read a final 4 as よ instead of よん (4円 よえん, 4年 よねん). */
  yo: boolean;
}

const digit = (d: number, f: NumFlags): string => (d === 7 && f.shichi ? 'しち' : ONES[d]!);

function hundredsWord(d: number, f: NumFlags): string {
  if (d === 1) return 'ひゃく';
  if (d === 3) return 'さんびゃく';
  if (d === 6) return 'ろっぴゃく';
  if (d === 8) return 'はっぴゃく';
  return `${digit(d, f)}ひゃく`;
}

function thousandsWord(d: number, f: NumFlags, forceIssen: boolean): string {
  if (d === 1) return f.issen || forceIssen ? 'いっせん' : 'せん';
  if (d === 3) return 'さんぜん';
  if (d === 8) return 'はっせん';
  return `${digit(d, f)}せん`;
}

function under10000(r: number, f: NumFlags, forceIssen = false): string {
  const th = Math.floor(r / 1000);
  const h = Math.floor((r % 1000) / 100);
  const t = Math.floor((r % 100) / 10);
  const o = r % 10;
  let s = '';
  if (th) s += thousandsWord(th, f, forceIssen);
  if (h) s += hundredsWord(h, f);
  if (t) s += `${t > 1 ? digit(t, f) : ''}じゅう`;
  if (o) s += digit(o, f);
  return s;
}

function buildNumber(n: number, f: NumFlags): string {
  if (n === 0) return 'ぜろ';
  const m = Math.floor(n / 10000);
  const r = n % 10000;
  let s = '';
  if (m) {
    // 一万 is always いちまん; 千万 is いっせんまん.
    s += m === 1 ? 'いちまん' : `${under10000(m, f, m === 1000)}まん`;
  }
  s += under10000(r, f);
  if (f.yo && n % 10 === 4) s = `${s.slice(0, -2)}よ`; // ...よん -> ...よ
  return s;
}

/** Primary kana plus accepted variants (しち for 7, いっせん, よん for よ) of a number. */
function numberVariants(n: number, yo = false): string[] {
  const primaryFlags: NumFlags = { shichi: false, issen: false, yo: yo && n % 10 === 4 };
  const primary = buildNumber(n, primaryFlags);
  const out = new Set<string>([primary]);
  for (let mask = 1; mask < 8; mask++) {
    out.add(
      buildNumber(n, {
        shichi: (mask & 1) !== 0,
        issen: (mask & 2) !== 0,
        yo: (mask & 4) !== 0 ? !primaryFlags.yo && yo && n % 10 === 4 : primaryFlags.yo,
      }),
    );
  }
  if (n === 0) out.add('れい');
  return [...out];
}

function numberReading(n: number, yo = false, suffix = ''): Reading {
  const [primary, ...alts] = numberVariants(n, yo) as [string, ...string[]];
  return makeReading(primary + suffix, alts.map((a) => a + suffix));
}

/**
 * Reads an integer 0..99,999,999 in hiragana.
 * Irregulars: さんびゃく, ろっぴゃく, はっぴゃく, さんぜん, はっせん, 1000 -> せん
 * (alternative いっせん), 10000 -> いちまん, 千万 -> いっせんまん.
 * Alternatives: 0 れい, 7 しち, いっせん.
 */
export function readNumber(n: number): Reading {
  assertInt(n, 0, MAX_NUMBER, 'Number');
  return numberReading(n);
}

/** Reads a price: number + えん. 4円 is よえん (alternative よんえん). */
export function readPrice(n: number): Reading {
  assertInt(n, 0, MAX_NUMBER, 'Price');
  return numberReading(n, true, 'えん');
}

/** Reads a year: number + ねん (1999 -> せんきゅうひゃくきゅうじゅうきゅうねん). 4年 is よねん. */
export function readYear(y: number): Reading {
  assertInt(y, 1, 9999, 'Year');
  return numberReading(y, true, 'ねん');
}

// ---------------------------------------------------------------------------
// Counters
// ---------------------------------------------------------------------------

export const COUNTERS = ['tsu', 'nin', 'kai', 'times', 'sai', 'hon', 'mai', 'fun', 'ji'] as const;
export type Counter = (typeof COUNTERS)[number];

interface CounterSpec {
  /** Reading for 1..9 as the last digit (index 0 is unused); primary first. */
  ones: string[][];
  /** Replacement for ones when the whole number is a single digit (ひとり, ふたり). */
  alone?: string[][];
  /** The "ten" term including the counter (じゅっぽん); the digit prefix is added in front. */
  ten: string[];
  /** Replacement for the final く of ひゃく (ひゃっ + ぽん); null = ひゃく + plain. */
  hundredTail: string | null;
  /** Counter attached after thousands, 万 and other round numbers. */
  plain: string;
  /** Counter after ぜろ. */
  zero: string[];
}

const wrap = (...xs: string[][]): string[][] => [[], ...xs];

const SPECS: Record<Exclude<Counter, 'tsu'>, CounterSpec> = {
  nin: {
    ones: wrap(['いちにん'], ['ににん'], ['さんにん'], ['よにん'], ['ごにん'], ['ろくにん'], ['ななにん', 'しちにん'], ['はちにん'], ['きゅうにん']),
    alone: wrap(['ひとり'], ['ふたり'], ['さんにん'], ['よにん'], ['ごにん'], ['ろくにん'], ['ななにん', 'しちにん'], ['はちにん'], ['きゅうにん']),
    ten: ['じゅうにん'],
    hundredTail: null,
    plain: 'にん',
    zero: ['ぜろにん', 'れいにん'],
  },
  // 階 (floor of a building): 3 -> がい.
  kai: {
    ones: wrap(['いっかい'], ['にかい'], ['さんがい'], ['よんかい'], ['ごかい'], ['ろっかい'], ['ななかい', 'しちかい'], ['はっかい', 'はちかい'], ['きゅうかい']),
    ten: ['じゅっかい', 'じっかい'],
    hundredTail: 'っかい',
    plain: 'かい',
    zero: ['ぜろかい', 'れいかい'],
  },
  // 回 (number of times): same as 階 except 3 -> かい.
  times: {
    ones: wrap(['いっかい'], ['にかい'], ['さんかい'], ['よんかい'], ['ごかい'], ['ろっかい'], ['ななかい', 'しちかい'], ['はっかい', 'はちかい'], ['きゅうかい']),
    ten: ['じゅっかい', 'じっかい'],
    hundredTail: 'っかい',
    plain: 'かい',
    zero: ['ぜろかい', 'れいかい'],
  },
  sai: {
    ones: wrap(['いっさい'], ['にさい'], ['さんさい'], ['よんさい'], ['ごさい'], ['ろくさい'], ['ななさい', 'しちさい'], ['はっさい', 'はちさい'], ['きゅうさい']),
    ten: ['じゅっさい', 'じっさい'],
    hundredTail: null,
    plain: 'さい',
    zero: ['ぜろさい', 'れいさい'],
  },
  hon: {
    ones: wrap(['いっぽん'], ['にほん'], ['さんぼん'], ['よんほん'], ['ごほん'], ['ろっぽん'], ['ななほん', 'しちほん'], ['はっぽん', 'はちほん'], ['きゅうほん']),
    ten: ['じゅっぽん', 'じっぽん'],
    hundredTail: 'っぽん',
    plain: 'ぼん',
    zero: ['ぜろほん', 'れいほん'],
  },
  mai: {
    ones: wrap(['いちまい'], ['にまい'], ['さんまい'], ['よんまい'], ['ごまい'], ['ろくまい'], ['ななまい', 'しちまい'], ['はちまい'], ['きゅうまい']),
    ten: ['じゅうまい'],
    hundredTail: null,
    plain: 'まい',
    zero: ['ぜろまい', 'れいまい'],
  },
  fun: {
    ones: wrap(['いっぷん'], ['にふん'], ['さんぷん'], ['よんぷん'], ['ごふん'], ['ろっぷん'], ['ななふん', 'しちふん'], ['はっぷん', 'はちふん'], ['きゅうふん']),
    ten: ['じゅっぷん', 'じっぷん'],
    hundredTail: 'っぷん',
    plain: 'ぷん',
    zero: ['ぜろふん', 'れいふん'],
  },
  // 時 (o'clock): 4 よじ, 7 しちじ, 9 くじ.
  ji: {
    ones: wrap(['いちじ'], ['にじ'], ['さんじ'], ['よじ'], ['ごじ'], ['ろくじ'], ['しちじ'], ['はちじ'], ['くじ']),
    ten: ['じゅうじ'],
    hundredTail: null,
    plain: 'じ',
    zero: ['れいじ', 'ぜろじ'],
  },
};

const TSU = ['', 'ひとつ', 'ふたつ', 'みっつ', 'よっつ', 'いつつ', 'むっつ', 'ななつ', 'やっつ', 'ここのつ', 'とお'];

const NO_FLAGS: NumFlags = { shichi: false, issen: false, yo: false };

function counterVariants(n: number, spec: CounterSpec): string[] {
  if (n === 0) return spec.zero;
  const head = (value: number): string => (value > 0 ? buildNumber(value, NO_FLAGS) : '');
  const o = n % 10;
  if (o) {
    const table = n < 10 && spec.alone ? spec.alone : spec.ones;
    return table[o]!.map((v) => head(n - o) + v);
  }
  if (n % 100) {
    const t = (n % 100) / 10;
    return spec.ten.map((v) => head(n - t * 10) + (t > 1 ? ONES[t]! : '') + v);
  }
  if (n % 1000 && spec.hundredTail !== null) {
    const h = (n % 1000) / 100;
    return [head(n - h * 100) + hundredsWord(h, NO_FLAGS).slice(0, -1) + spec.hundredTail];
  }
  return [buildNumber(n, NO_FLAGS) + spec.plain];
}

/**
 * Reads `n` with a counter.
 * - 'tsu' (native count): ひとつ … とお for 1..10; from 11 the plain number is returned (no つ).
 * - 'nin' people: ひとり, ふたり, さんにん, よにん, …
 * - 'kai' floors (階): いっかい, にかい, さんがい, よんかい, ろっかい, はっかい (alt はちかい), じゅっかい
 * - 'times' occurrences (回): like 'kai' but さんかい
 * - 'sai' age: いっさい, はっさい, じゅっさい, 20 -> はたち (alts にじゅっさい, にじっさい)
 * - 'hon' long objects, 'mai' flat objects, 'fun' minutes, 'ji' o'clock.
 */
export function readCounter(n: number, counter: Counter): Reading {
  assertInt(n, 0, MAX_NUMBER, 'Count');
  if (counter === 'tsu') {
    if (n >= 1 && n <= 10) return makeReading(TSU[n]!);
    return readNumber(n);
  }
  const spec = SPECS[counter];
  const [primary, ...alts] = counterVariants(n, spec) as [string, ...string[]];
  // 20 years old is normally はたち; the regular readings stay accepted.
  if (counter === 'sai' && n === 20) return makeReading('はたち', [...new Set([primary, ...alts])]);
  return makeReading(primary, alts);
}

/** The question word for a counter (なんにん, なんがい, なんさい…). */
export function readCounterQuestion(counter: Counter): Reading {
  switch (counter) {
    case 'tsu':
      return makeReading('いくつ');
    case 'nin':
      return makeReading('なんにん');
    case 'kai':
      return makeReading('なんがい');
    case 'times':
      return makeReading('なんかい');
    case 'sai':
      return makeReading('なんさい', ['おいくつ']);
    case 'hon':
      return makeReading('なんぼん');
    case 'mai':
      return makeReading('なんまい');
    case 'fun':
      return makeReading('なんぷん');
    case 'ji':
      return makeReading('なんじ');
  }
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

export interface TimeOptions {
  /** Prefix ごぜん / ごご and use the 12-hour clock. */
  ampm?: boolean;
}

/**
 * Reads a clock time. Hours 0..23, minutes 0..59.
 * Minute 0 is omitted (よじ), 30 is はん (alternatives: さんじゅっぷん / さんじっぷん).
 * Minutes use ふん/ぷん: いっぷん, にふん, さんぷん, よんぷん, ごふん, ろっぷん, ななふん, はっぷん,
 * きゅうふん, じゅっぷん (alt じっぷん), にじゅうごふん…
 */
export function readTime(h: number, m: number, options: TimeOptions = {}): Reading {
  assertInt(h, 0, 23, 'Hour');
  assertInt(m, 0, 59, 'Minute');
  let prefix = '';
  let hour = h;
  if (options.ampm) {
    prefix = h < 12 ? 'ごぜん' : 'ごご';
    hour = h === 0 ? 0 : h % 12 === 0 ? 12 : h % 12;
  }
  const hourReading = readCounter(hour, 'ji');
  const hourKana = prefix + hourReading.kana;
  const hourAlts = hourReading.alternatives.map((a) => prefix + a);
  if (m === 0) return makeReading(hourKana, hourAlts);
  const minute = readCounter(m, 'fun');
  const minutes = m === 30 ? ['はん', ...allReadings(minute)] : allReadings(minute);
  const all = [hourKana, ...hourAlts].flatMap((hk) => minutes.map((mk) => hk + mk));
  return makeReading(all[0]!, all.slice(1));
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const MONTHS = ['いちがつ', 'にがつ', 'さんがつ', 'しがつ', 'ごがつ', 'ろくがつ', 'しちがつ', 'はちがつ', 'くがつ', 'じゅうがつ', 'じゅういちがつ', 'じゅうにがつ'];
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Special day-of-month readings (the 1st..10th, 14th, 20th, 24th). */
const SPECIAL_DAYS: Record<number, string> = {
  1: 'ついたち',
  2: 'ふつか',
  3: 'みっか',
  4: 'よっか',
  5: 'いつか',
  6: 'むいか',
  7: 'なのか',
  8: 'ようか',
  9: 'ここのか',
  10: 'とおか',
  14: 'じゅうよっか',
  20: 'はつか',
  24: 'にじゅうよっか',
};

/** Month name: しがつ, しちがつ (alt なながつ), くがつ. */
export function readMonth(month: number): Reading {
  assertInt(month, 1, 12, 'Month');
  return makeReading(MONTHS[month - 1]!, month === 7 ? ['なながつ'] : []);
}

/**
 * Day of the month, 1..31: ついたち, ふつか, みっか, よっか, いつか, むいか, なのか, ようか, ここのか,
 * とおか, じゅうよっか, はつか, にじゅうよっか; the rest are N + にち
 * (じゅうしちにち alt じゅうななにち, にじゅうしちにち alt にじゅうななにち).
 */
export function readDayOfMonth(day: number): Reading {
  assertInt(day, 1, 31, 'Day');
  const special = SPECIAL_DAYS[day];
  if (special) return makeReading(special);
  // 17th / 27th: しち is the standard reading, なな is accepted.
  if (day % 10 === 7) {
    return makeReading(`${buildNumber(day, { ...NO_FLAGS, shichi: true })}にち`, [`${buildNumber(day, NO_FLAGS)}にち`]);
  }
  // 19th / 29th: く is the standard reading, きゅう is accepted.
  if (day % 10 === 9) {
    return makeReading(`${buildNumber(day, NO_FLAGS).slice(0, -3)}くにち`, [`${buildNumber(day, NO_FLAGS)}にち`]);
  }
  return makeReading(`${buildNumber(day, NO_FLAGS)}にち`);
}

export interface DateReading extends Reading {
  month: Reading;
  day: Reading;
}

/** Month + day, e.g. (4, 1) -> しがつ ついたち written together: しがつついたち. */
export function readDate(month: number, day: number): DateReading {
  assertInt(month, 1, 12, 'Month');
  assertInt(day, 1, DAYS_IN_MONTH[month - 1]!, 'Day');
  const m = readMonth(month);
  const d = readDayOfMonth(day);
  const all = allReadings(m).flatMap((mk) => allReadings(d).map((dk) => mk + dk));
  return { ...makeReading(all[0]!, all.slice(1)), month: m, day: d };
}

const WEEKDAYS = ['にちようび', 'げつようび', 'かようび', 'すいようび', 'もくようび', 'きんようび', 'どようび'];

/** Day of the week, 0 = Sunday (like Date#getDay) .. 6 = Saturday. */
export function readDayOfWeek(day: number): Reading {
  assertInt(day, 0, 6, 'Day of week');
  return makeReading(WEEKDAYS[day]!);
}
