import { toKatakana } from 'wanakana';
import { describe, expect, it } from 'vitest';
import { checkAnswer, levenshtein, normalizeAnswer } from './answer';

describe('levenshtein', () => {
  it.each([
    ['', '', 0],
    ['abc', '', 3],
    ['', 'abc', 3],
    ['たべる', 'たべる', 0],
    ['たべる', 'たべま', 1],
    ['たべる', 'たべ', 1],
    ['たべる', 'たたべる', 1],
    ['たべる', 'のむ', 3],
    ['kitten', 'sitting', 3],
  ])('%s vs %s = %i', (a, b, d) => {
    expect(levenshtein(a, b)).toBe(d);
  });
});

describe('normalizeAnswer', () => {
  it('trims and removes spaces', () => {
    expect(normalizeAnswer('  たべ ます ')).toBe('たべます');
    expect(normalizeAnswer('たべ　ます')).toBe('たべます');
  });
  it('keeps spaces when asked', () => {
    expect(normalizeAnswer(' たべ  ます ', { ignoreSpaces: false })).toBe('たべ ます');
  });
  it('converts full-width latin and half-width katakana', () => {
    expect(normalizeAnswer('ｔａｂｅｍａｓｕ')).toBe('たべます');
    expect(normalizeAnswer('ﾀﾍﾞﾙ')).toBe('たべる');
  });
  it('converts romaji to hiragana, case-insensitively', () => {
    expect(normalizeAnswer('tabemasu')).toBe('たべます');
    expect(normalizeAnswer('TABEMASU')).toBe('たべます');
    expect(normalizeAnswer('kon')).toBe('こん');
    expect(normalizeAnswer('shi')).toBe('し');
    expect(normalizeAnswer('si')).toBe('し');
    expect(normalizeAnswer('kyou')).toBe('きょう');
    expect(normalizeAnswer('gakkou')).toBe('がっこう');
  });
  it('can leave romaji alone', () => {
    expect(normalizeAnswer('ka', { romajiToKana: false })).toBe('ka');
  });
  it('maps katakana to hiragana unless script matters', () => {
    expect(normalizeAnswer('テニス')).toBe('てにす');
    expect(normalizeAnswer('テニス', { scriptSensitive: true })).toBe('テニス');
    expect(normalizeAnswer('tenisu', { scriptSensitive: true }, 'katakana')).toBe('テニス');
  });
  it('removes punctuation but keeps ー', () => {
    expect(normalizeAnswer('たべます。')).toBe('たべます');
    expect(normalizeAnswer('「たべます」！')).toBe('たべます');
    expect(normalizeAnswer('コーヒー')).toBe('こーひー');
    expect(normalizeAnswer('ko-hi-')).toBe('こーひー');
  });
});

describe('checkAnswer: exact and normalised matches', () => {
  it('accepts the exact answer', () => {
    expect(checkAnswer('たべます', 'たべます')).toEqual({
      correct: true,
      normalizedInput: 'たべます',
      expected: 'たべます',
      nearMiss: false,
    });
  });
  it('accepts romaji for kana', () => {
    expect(checkAnswer('tabemasu', 'たべます').correct).toBe(true);
    expect(checkAnswer('Tabemasu', 'たべます').correct).toBe(true);
    expect(checkAnswer('tabe masu', 'たべます').correct).toBe(true);
    expect(checkAnswer('taberu', 'たべる').correct).toBe(true);
  });
  it('accepts full-width input and stray spaces', () => {
    expect(checkAnswer(' ｔａｂｅｍａｓｕ　', 'たべます').correct).toBe(true);
    expect(checkAnswer('た べ ま す', 'たべます').correct).toBe(true);
  });
  it('accepts katakana input for hiragana answers and vice versa', () => {
    expect(checkAnswer('タベマス', 'たべます').correct).toBe(true);
    expect(checkAnswer('こーひー', 'コーヒー').correct).toBe(true);
    expect(checkAnswer('テニス', 'てにす').correct).toBe(true);
  });
  it('script matters when asked', () => {
    expect(checkAnswer('てにす', 'テニス', { scriptSensitive: true }).correct).toBe(false);
    expect(checkAnswer('テニス', 'テニス', { scriptSensitive: true }).correct).toBe(true);
    expect(checkAnswer('tenisu', 'テニス', { scriptSensitive: true }).correct).toBe(true);
    expect(checkAnswer('tenisu', 'てにす', { scriptSensitive: true }).correct).toBe(true);
  });
  it('ignores trailing punctuation', () => {
    expect(checkAnswer('たべます。', 'たべます').correct).toBe(true);
  });
  it('rejects different answers and empty input', () => {
    expect(checkAnswer('のみます', 'たべます').correct).toBe(false);
    expect(checkAnswer('', 'たべます')).toMatchObject({ correct: false, nearMiss: false });
    expect(checkAnswer('   ', 'たべます').correct).toBe(false);
  });
  it('both sides can be romaji (kana recognition games)', () => {
    expect(checkAnswer('shi', 'si').correct).toBe(true);
    expect(checkAnswer('ka', 'ka').correct).toBe(true);
    expect(checkAnswer('ki', 'ka').correct).toBe(false);
  });
});

describe('checkAnswer: alternatives', () => {
  it('accepts any alternative and reports which one matched', () => {
    const opts = { alternatives: ['じっぷん'] };
    expect(checkAnswer('じゅっぷん', 'じゅっぷん', opts)).toMatchObject({ correct: true, expected: 'じゅっぷん' });
    expect(checkAnswer('じっぷん', 'じゅっぷん', opts)).toMatchObject({ correct: true, expected: 'じっぷん' });
    expect(checkAnswer('jippun', 'じゅっぷん', opts).correct).toBe(true);
    expect(checkAnswer('juppun', 'じゅっぷん', opts).correct).toBe(true);
  });
  it('accepts an array of expected answers', () => {
    expect(checkAnswer('しち', ['なな', 'しち']).correct).toBe(true);
    expect(checkAnswer('なな', ['なな', 'しち']).correct).toBe(true);
    expect(checkAnswer('ご', ['なな', 'しち']).correct).toBe(false);
  });
  it('requires at least one expected answer', () => {
    expect(() => checkAnswer('あ', [])).toThrow();
  });
});

describe('checkAnswer: particles', () => {
  it('lenient mode accepts pronunciation spellings', () => {
    expect(checkAnswer('わ', 'は').correct).toBe(true);
    expect(checkAnswer('wa', 'は').correct).toBe(true);
    expect(checkAnswer('お', 'を').correct).toBe(true);
    expect(checkAnswer('o', 'を').correct).toBe(true);
    expect(checkAnswer('え', 'へ').correct).toBe(true);
    expect(checkAnswer('こんにちわ', 'こんにちは').correct).toBe(true);
    expect(checkAnswer('konnichiwa', 'こんにちは').correct).toBe(true);
    expect(checkAnswer('konbanwa', 'こんばんは').correct).toBe(true);
  });
  it('lenient mode does not change the middle of a word', () => {
    expect(checkAnswer('わな', 'はな').correct).toBe(false);
    expect(checkAnswer('おんな', 'をんな').correct).toBe(true); // を is only ever a particle; harmless
  });
  it('strict mode keeps は/わ, を/お and へ/え apart', () => {
    expect(checkAnswer('は', 'は', { strict: true }).correct).toBe(true);
    expect(checkAnswer('わ', 'は', { strict: true }).correct).toBe(false);
    expect(checkAnswer('wa', 'は', { strict: true }).correct).toBe(false);
    expect(checkAnswer('ha', 'は', { strict: true }).correct).toBe(true);
    expect(checkAnswer('を', 'を', { strict: true }).correct).toBe(true);
    expect(checkAnswer('wo', 'を', { strict: true }).correct).toBe(true);
    expect(checkAnswer('お', 'を', { strict: true }).correct).toBe(false);
    expect(checkAnswer('o', 'を', { strict: true }).correct).toBe(false);
    expect(checkAnswer('え', 'へ', { strict: true }).correct).toBe(false);
    expect(checkAnswer('he', 'へ', { strict: true }).correct).toBe(true);
    expect(checkAnswer('こんにちわ', 'こんにちは', { strict: true }).correct).toBe(false);
  });
  it('strict mode: choosing わ when は is expected is a plain miss, not a near miss', () => {
    expect(checkAnswer('わ', 'は', { strict: true })).toMatchObject({ correct: false, nearMiss: false });
  });
});

describe('checkAnswer: long vowels', () => {
  it('matches ー with the spelled-out vowel', () => {
    expect(checkAnswer('koohii', 'コーヒー').correct).toBe(true);
    expect(checkAnswer('こうひい', 'コーヒー').correct).toBe(true);
    expect(checkAnswer('ko-hi-', 'コーヒー').correct).toBe(true);
    expect(checkAnswer('rameen', 'ラーメン').correct).toBe(false);
    expect(checkAnswer('raamen', 'ラーメン').correct).toBe(true);
  });
  it('does not blur おう and おお in ordinary words', () => {
    expect(checkAnswer('おうきい', 'おおきい').correct).toBe(false);
    expect(checkAnswer('ookii', 'おおきい').correct).toBe(true);
  });
});

describe('checkAnswer: near misses', () => {
  it('flags a one-character typo in a long enough answer', () => {
    expect(checkAnswer('たべまし', 'たべます')).toMatchObject({ correct: false, nearMiss: true, expected: 'たべます' });
    expect(checkAnswer('たべまし', 'たべました')).toMatchObject({ correct: false, nearMiss: true });
    expect(checkAnswer('たべまっす', 'たべます').nearMiss).toBe(true);
    expect(checkAnswer('たべませ', 'たべます').nearMiss).toBe(true);
    expect(checkAnswer('tabemas', 'たべます').nearMiss).toBe(true);
  });
  it('is not a near miss for short answers (3 kana or fewer)', () => {
    expect(checkAnswer('たべ', 'たべる').nearMiss).toBe(false);
    expect(checkAnswer('のむ', 'のめ').nearMiss).toBe(false);
    expect(checkAnswer('あか', 'あお').nearMiss).toBe(false);
    expect(checkAnswer('たべり', 'たべる').nearMiss).toBe(false);
  });
  it('4 kana is long enough', () => {
    expect(checkAnswer('のみまし', 'のみます').nearMiss).toBe(true);
  });
  it('two edits are not a near miss', () => {
    expect(checkAnswer('たべもし', 'たべます').nearMiss).toBe(false);
    expect(checkAnswer('たびまし', 'たべます').nearMiss).toBe(false);
  });
  it('a correct answer is never a near miss', () => {
    expect(checkAnswer('たべます', 'たべます').nearMiss).toBe(false);
  });
  it('near miss considers alternatives and reports the closest one', () => {
    const r = checkAnswer('じっぷ', 'じゅっぷん', { alternatives: ['じっぷん'] });
    expect(r).toMatchObject({ correct: false, nearMiss: true, expected: 'じっぷん' });
  });
  it('empty input is never a near miss', () => {
    expect(checkAnswer('', 'たべます').nearMiss).toBe(false);
  });
  it('returns the normalized input for display', () => {
    expect(checkAnswer(' NOMIMASU ', 'たべます').normalizedInput).toBe('のみます');
  });
});

describe('checkAnswer: katakana long vowel (script-sensitive, as typed in the katakana IME)', () => {
  const strict = { strict: true, scriptSensitive: true } as const;
  it('accepts the hyphen and the repeated vowel for ー', () => {
    // wanakana turns `koohii` into コオヒイ in katakana mode: it must still match コーヒー
    expect(toKatakana('koohii')).toBe('コオヒイ');
    expect(checkAnswer('コオヒイ', 'コーヒー', strict).correct).toBe(true);
    expect(checkAnswer('koohii', 'コーヒー', strict).correct).toBe(true);
    expect(checkAnswer('コーヒー', 'コーヒー', strict).correct).toBe(true);
    expect(checkAnswer('ko-hi-', 'コーヒー', strict).correct).toBe(true);
    expect(checkAnswer('コウヒイ', 'コーヒー', strict).correct).toBe(true);
  });
  it('handles ー after every vowel row and ッ', () => {
    expect(checkAnswer('paatii', 'パーティー', strict).correct).toBe(false); // `ti` is チ, the IME needs `thi`
    expect(checkAnswer('paathii', 'パーティー', strict).correct).toBe(true);
    expect(checkAnswer('sakkaa', 'サッカー', strict).correct).toBe(true);
    expect(checkAnswer('suupaa', 'スーパー', strict).correct).toBe(true);
    expect(checkAnswer('suupa', 'スーパー', strict).correct).toBe(false);
  });
  it('does not accept hiragana for a katakana target in script-sensitive mode', () => {
    expect(checkAnswer('こーひー', 'コーヒー', strict).correct).toBe(false);
  });
  it('a lone typed hyphen is the long-vowel mark', () => {
    expect(checkAnswer('-', 'ー', strict).correct).toBe(true);
  });
});
