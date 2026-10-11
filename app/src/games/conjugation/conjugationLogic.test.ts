import { content } from '../../domain/contentLoader';
import { VERB_FORM_IDS } from '../../engine';
import {
  ALL_FORMS,
  CATEGORIES,
  LESSON_FORMS,
  acceptedFor,
  conjEntries,
  isUnnaturalForm,
  conjugableWords,
  formLabel,
  formsForLesson,
  readingFor,
  ruleHint,
} from './conjugationLogic';

const word = (id: string) => content.vocab.find((w) => w.id === id)!;

describe('formsForLesson', () => {
  it('ます lessons give the four ます forms', () => {
    expect(formsForLesson('l-conj-masu').verb).toEqual(['masu', 'masen', 'mashita', 'masendeshita']);
    expect(formsForLesson('l-verbos-1').verb).toEqual(['masu', 'masen']);
  });

  it('the invitation lesson adds ませんか / ましょう / ましょうか', () => {
    const forms = formsForLesson('l-invitar').verb;
    expect(forms).toEqual(expect.arrayContaining(['masu', 'masenka', 'mashou', 'mashouka']));
  });

  it('て lessons add て, てください, てもいいです, てはいけません, ています, たいです', () => {
    expect(formsForLesson('l-te-kudasai').verb).toEqual(expect.arrayContaining(['te', 'tekudasai']));
    expect(formsForLesson('l-permisos').verb).toEqual(['te', 'temoiidesu', 'tehaikemasen']);
    expect(formsForLesson('l-te-imasu-tai').verb).toEqual(['te', 'teimasu', 'taidesu']);
  });

  it('adjective and noun lessons give the four tenses', () => {
    expect(formsForLesson('l-adjetivos-i')['i-adj']).toEqual(['present', 'past', 'negative', 'negativePast']);
    expect(formsForLesson('l-adjetivos-na')['na-adj']).toHaveLength(4);
    expect(formsForLesson('l-adjetivos-na').noun).toHaveLength(4);
    expect(formsForLesson('l-pasado').noun).toHaveLength(4);
    expect(formsForLesson('l-pasado').verb).toEqual(['mashita', 'masendeshita']);
  });

  it('falls back to the lesson patterns, then to the ます forms; free practice gets everything', () => {
    expect(formsForLesson('l-nuevo', ['te-mo-ii']).verb).toEqual(['te', 'temoiidesu']);
    expect(formsForLesson('l-nuevo', ['adj-past'])['i-adj']).toHaveLength(4);
    expect(formsForLesson('l-nuevo', ['nada']).verb).toHaveLength(4);
    expect(formsForLesson(undefined)).toEqual(ALL_FORMS);
  });

  it('every mapped lesson exists in the curriculum and every form id is valid with a label', () => {
    const lessonIds = new Set(content.curriculum.map((l) => l.id));
    for (const [id, cfg] of Object.entries(LESSON_FORMS)) {
      expect(lessonIds.has(id)).toBe(true);
      for (const f of cfg.verb) expect(VERB_FORM_IDS).toContain(f);
      for (const c of CATEGORIES) for (const f of cfg[c]) expect(formLabel(c, f)).toBeTruthy();
    }
    // every stage 2 lesson with the conjugation game has forms
    for (const l of content.curriculum.filter((x) => x.stage === 2 && x.games.includes('conjugation'))) {
      expect(CATEGORIES.some((c) => formsForLesson(l.id)[c].length > 0)).toBe(true);
    }
  });
});

describe('conjugation of the content', () => {
  it('conjugates every usable word in every form and gives a hint', () => {
    for (const c of CATEGORIES) {
      const words = conjugableWords(content.vocab, c);
      expect(words.length).toBeGreaterThan(5);
      for (const w of words) {
        for (const f of ALL_FORMS[c]) {
          expect(acceptedFor(w, c, f)[0]).toMatch(/^[ぁ-ゖァ-ヺー]+$/u);
          expect(ruleHint(w, c, f)).toBeTruthy();
        }
      }
    }
  });

  it('builds one entry per word and form, with ids like verb:<word>:<form>', () => {
    const entries = conjEntries([word('taberu')], 'verb', ['masu', 'masen']);
    expect(entries.map((e) => e.id)).toEqual(['verb:taberu:masu', 'verb:taberu:masen']);
  });

  it('QA-033: non-volitional verbs are not asked in ましょう / てください / たい forms', () => {
    const forms = ['masu', 'mashou', 'mashouka', 'tekudasai', 'taidesu', 'takunaidesu', 'te'] as const;
    const ids = (verb: string) => conjEntries([word(verb)], 'verb', forms).map((e) => e.id.split(':')[2]);
    for (const verb of ['aru', 'wakaru', 'iru', 'iru-necesitar']) expect(ids(verb)).toEqual(['masu', 'te']);
    expect(ids('taberu')).toEqual([...forms]);
    expect(isUnnaturalForm(word('aru'), 'verb', 'tekudasai')).toBe(true);
    expect(isUnnaturalForm(word('aru'), 'verb', 'mashouka')).toBe(true);
    expect(isUnnaturalForm(word('wakaru'), 'verb', 'taidesu')).toBe(true);
    expect(isUnnaturalForm(word('aru'), 'verb', 'masen')).toBe(false);
    expect(isUnnaturalForm(word('taberu'), 'verb', 'taidesu')).toBe(false);
  });

  it('the hint for いい-adjectives only talks about よ- for real いい compounds', () => {
    expect(ruleHint(word('ii'), 'i-adj', 'past')).toMatch(/よ-/);
    const kawaii = content.vocab.find((w) => w.kana === 'かわいい');
    if (kawaii) expect(ruleHint(kawaii, 'i-adj', 'past')).not.toMatch(/よ-/);
  });

  it('readingFor matches the engine', () => {
    expect(readingFor(word('taberu'), 'verb', 'mashita').kana).toBe('たべました');
    expect(readingFor(word('nomu'), 'verb', 'te').kana).toBe('のんで');
  });
});

describe('ruleHint', () => {
  it('names the group and the rule', () => {
    expect(ruleHint(word('nomu'), 'verb', 'masu')).toBe('Grupo I: む→み + ます');
    expect(ruleHint(word('taberu'), 'verb', 'masen')).toBe('Grupo II: quita る + ません');
    expect(ruleHint(word('suru'), 'verb', 'mashita')).toBe('Grupo III (irregular): する→し + ました');
    expect(ruleHint(word('kuru'), 'verb', 'masu')).toContain('くる→き');
    expect(ruleHint(word('nomu'), 'verb', 'tekudasai')).toBe('Grupo I: む→んで + ください');
    expect(ruleHint(word('taberu'), 'verb', 'te')).toBe('Grupo II: quita る + て');
    expect(ruleHint(word('iku'), 'verb', 'te')).toContain('excepción');
  });

  it('adjectives and nouns', () => {
    const adj = content.vocab.find((w) => w.pos === 'i-adj' && w.kana === 'たかい')!;
    expect(ruleHint(adj, 'i-adj', 'negative')).toBe('Adjetivo い: quita い + くないです');
    const ii = content.vocab.find((w) => w.pos === 'i-adj' && w.kana === 'いい')!;
    expect(ruleHint(ii, 'i-adj', 'past')).toContain('よ');
    const na = content.vocab.find((w) => w.pos === 'na-adj' && w.kana === 'きれい')!;
    expect(ruleHint(na, 'na-adj', 'negative')).toBe('Adjetivo な (sin な): + じゃないです');
  });
});
