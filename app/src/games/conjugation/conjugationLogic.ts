import {
  ADJ_FORM_LABELS_ES,
  FORM_LABELS_ES,
  allReadings,
  conjugateIAdjective,
  conjugateNaAdjective,
  conjugateNoun,
  conjugateVerb,
  type IAdjFormId,
  type NaAdjFormId,
  type NounFormId,
  type VerbFormId,
  type Reading,
  type VerbGroup,
} from '../../engine';
import type { Word } from '../../domain/schema';


export type Category = 'verb' | 'i-adj' | 'na-adj' | 'noun';
export const CATEGORIES: Category[] = ['verb', 'i-adj', 'na-adj', 'noun'];
export const CATEGORY_LABELS: Record<Category, string> = { verb: 'Verbos', 'i-adj': 'Adjetivos い', 'na-adj': 'Adjetivos な', noun: 'Sustantivos + です' };

export interface FormConfig {
  verb: VerbFormId[];
  'i-adj': IAdjFormId[];
  'na-adj': NaAdjFormId[];
  noun: NounFormId[];
}

const COPULA_TENSES = ['present', 'past', 'negative', 'negativePast'] as const;
const MASU4: VerbFormId[] = ['masu', 'masen', 'mashita', 'masendeshita'];

/** Every form that can be practised in free practice. */
export const ALL_FORMS: FormConfig = {
  verb: [...MASU4, 'masenka', 'mashou', 'mashouka', 'te', 'tekudasai', 'temoiidesu', 'tehaikemasen', 'teimasu', 'taidesu'],
  'i-adj': [...COPULA_TENSES],
  'na-adj': [...COPULA_TENSES],
  noun: [...COPULA_TENSES],
};

const empty = (): FormConfig => ({ verb: [], 'i-adj': [], 'na-adj': [], noun: [] });
const make = (part: Partial<FormConfig>): FormConfig => ({ ...empty(), ...part });

/** Forms practised in each stage 2 lesson (by curriculum.json id). */
export const LESSON_FORMS: Record<string, FormConfig> = {
  'l-desu': make({ noun: ['present', 'negative'] }),
  'l-verbos-1': make({ verb: ['masu', 'masen'] }),
  'l-particulas': make({ verb: MASU4 }),
  'l-invitar': make({ verb: [...MASU4, 'masenka', 'mashou', 'mashouka'] }),
  'l-aru-iru': make({ verb: MASU4 }),
  'l-conj-masu': make({ verb: MASU4 }),
  'l-pasado': make({ verb: ['mashita', 'masendeshita'], noun: [...COPULA_TENSES] }),
  'l-adjetivos-i': make({ 'i-adj': [...COPULA_TENSES] }),
  'l-adjetivos-na': make({ 'na-adj': [...COPULA_TENSES], noun: [...COPULA_TENSES] }),
  'l-te-kudasai': make({ verb: ['te', 'tekudasai', 'mashouka'] }),
  'l-permisos': make({ verb: ['te', 'temoiidesu', 'tehaikemasen'] }),
  'l-te-imasu-tai': make({ verb: ['te', 'teimasu', 'taidesu'] }),
};

/** Same idea from the ids of the lesson's patterns (used when the lesson id is unknown). */
export const PATTERN_FORMS: Record<string, Partial<FormConfig>> = {
  'svo-masu': { verb: ['masu'] },
  'masu-masen': { verb: ['masu', 'masen'] },
  'masu-4-tenses': { verb: MASU4 },
  'mashita-masendeshita': { verb: ['mashita', 'masendeshita'] },
  'masen-ka': { verb: ['masenka'] },
  mashou: { verb: ['mashou'] },
  'mashou-ka-offer': { verb: ['mashouka'] },
  'te-kudasai': { verb: ['te', 'tekudasai'] },
  'te-form-connect': { verb: ['te'] },
  'te-mo-ii': { verb: ['te', 'temoiidesu'] },
  'te-wa-ikemasen': { verb: ['te', 'tehaikemasen'] },
  'te-imasu': { verb: ['te', 'teimasu'] },
  'tai-desu': { verb: ['taidesu'] },
  'adj-desu': { 'i-adj': [...COPULA_TENSES] },
  'adj-kunai': { 'i-adj': [...COPULA_TENSES] },
  'adj-past': { 'i-adj': [...COPULA_TENSES] },
  'noun-janai': { noun: [...COPULA_TENSES], 'na-adj': [...COPULA_TENSES] },
  deshita: { noun: [...COPULA_TENSES] },
  'noun-desu': { noun: ['present', 'negative'] },
};

const merge = <T,>(a: readonly T[], b: readonly T[]): T[] => [...new Set([...a, ...b])];

/**
 * Forms to practise: the lesson's own list; else the union of its patterns' forms; else the four ます forms.
 * No lesson id (free practice) = everything.
 */
export function formsForLesson(lessonId: string | undefined, patternIds: readonly string[] = []): FormConfig {
  if (lessonId === undefined) return structuredClone(ALL_FORMS);
  const known = LESSON_FORMS[lessonId];
  if (known) return structuredClone(known);
  const out = empty();
  for (const id of patternIds) {
    const part = PATTERN_FORMS[id];
    if (!part) continue;
    out.verb = merge(out.verb, part.verb ?? []);
    out['i-adj'] = merge(out['i-adj'], part['i-adj'] ?? []);
    out['na-adj'] = merge(out['na-adj'], part['na-adj'] ?? []);
    out.noun = merge(out.noun, part.noun ?? []);
  }
  if (CATEGORIES.every((c) => out[c].length === 0)) out.verb = [...MASU4];
  return out;
}

export type AnyForm = string;

export const formLabel = (category: Category, form: AnyForm): string =>
  category === 'verb' ? FORM_LABELS_ES[form as VerbFormId].label : ADJ_FORM_LABELS_ES[form as IAdjFormId].label;

const KANA_ONLY = /^[ぁ-ゖァ-ヺー]+$/u;

/** Reading of `form` for a word (throws when the word cannot be conjugated that way). */
export function readingFor(word: Word, category: Category, form: AnyForm): Reading {
  switch (category) {
    case 'verb':
      return conjugateVerb(word.kana, word.verbGroup as VerbGroup)[form as VerbFormId];
    case 'i-adj':
      return conjugateIAdjective(word.kana)[form as IAdjFormId];
    case 'na-adj':
      return conjugateNaAdjective(word.kana)[form as NaAdjFormId];
    case 'noun':
      return conjugateNoun(word.kana)[form as NounFormId];
  }
}

/** Every accepted kana for an answer. */
export const acceptedFor = (word: Word, category: Category, form: AnyForm): string[] => allReadings(readingFor(word, category, form));

const POS: Record<Category, Word['pos']> = { verb: 'verb', 'i-adj': 'i-adj', 'na-adj': 'na-adj', noun: 'noun' };

/** Words of a category that can be conjugated (kana only, no embedded object such as たばこをすう). */
export function conjugableWords(words: readonly Word[], category: Category): Word[] {
  return words.filter((w) => {
    if (w.pos !== POS[category] || !KANA_ONLY.test(w.kana)) return false;
    if (category === 'verb' && !w.verbGroup) return false;
    try {
      readingFor(w, category, category === 'verb' ? 'masu' : 'present');
      return true;
    } catch {
      return false;
    }
  });
}

export const GROUP_NAMES: Record<VerbGroup, string> = { u: 'Grupo I', ru: 'Grupo II', irregular: 'Grupo III' };

const MASU_SUFFIX: Partial<Record<VerbFormId, string>> = {
  masu: 'ます',
  masen: 'ません',
  mashita: 'ました',
  masendeshita: 'ませんでした',
  masenka: 'ませんか',
  mashou: 'ましょう',
  mashouka: 'ましょうか',
  taidesu: 'たいです',
};
const TE_SUFFIX: Partial<Record<VerbFormId, string>> = { tekudasai: 'ください', teimasu: 'います', temoiidesu: 'もいいです', tehaikemasen: 'はいけません' };

/** Short Spanish hint for the rule applied, e.g. «Grupo I: う→い + ます». */
export function ruleHint(word: Word, category: Category, form: AnyForm): string {
  if (category === 'verb') {
    const group = word.verbGroup as VerbGroup;
    const name = GROUP_NAMES[group];
    const dict = word.kana;
    const conj = conjugateVerb(dict, group);
    const last = dict.slice(-1);
    const suffix = MASU_SUFFIX[form as VerbFormId];
    if (suffix !== undefined) {
      const stem = conj.masu.kana.slice(0, -2);
      if (group === 'u') return `${name}: ${last}→${stem.slice(-1)} + ${suffix}`;
      if (group === 'ru') return `${name}: quita る + ${suffix}`;
      return `${name} (irregular): ${dict.endsWith('する') ? 'する→し' : 'くる→き'} + ${suffix}`;
    }
    const extra = TE_SUFFIX[form as VerbFormId];
    const te = conj.te.kana;
    const more = extra ? ` + ${extra}` : '';
    if (group === 'ru') return `${name}: quita る + て${more}`;
    if (group === 'irregular') return `${name} (irregular): ${dict.endsWith('する') ? 'する→して' : 'くる→きて'}${more}`;
    if (dict.endsWith('いく')) return `${name}: いく→いって (excepción)${more}`;
    return `${name}: ${last}→${te.slice(dict.length - 1)}${more}`;
  }
  const tense = form as NounFormId;
  if (category === 'i-adj') {
    if (word.kana.endsWith('いい')) return 'Adjetivo い: いい es irregular, usa よ- (よかったです, よくないです)';
    const rule = { present: 'el adjetivo + です', past: 'quita い + かったです', negative: 'quita い + くないです', negativePast: 'quita い + くなかったです' }[tense as 'present'];
    return `Adjetivo い: ${rule}`;
  }
  const rule = { present: '+ です', past: '+ でした', negative: '+ じゃないです', negativePast: '+ じゃなかったです' }[tense as 'present'];
  return `${category === 'na-adj' ? 'Adjetivo な (sin な)' : 'Sustantivo'}: ${rule}`;
}

export interface ConjEntry {
  /** Item id, e.g. verb:taberu:masu. */
  id: string;
  category: Category;
  word: Word;
  form: AnyForm;
}

const PREFIX: Record<Category, string> = { verb: 'verb', 'i-adj': 'iadj', 'na-adj': 'naadj', noun: 'noun' };

/** All (word, form) questions of a category. */
export function conjEntries(words: readonly Word[], category: Category, forms: readonly AnyForm[]): ConjEntry[] {
  return conjugableWords(words, category).flatMap((word) =>
    forms.map((form) => ({ id: `${PREFIX[category]}:${word.id}:${form}`, category, word, form })),
  );
}

/** Row id used when reporting table cells: same as the quiz item. */
export const entryId = (category: Category, word: Word, form: AnyForm): string => `${PREFIX[category]}:${word.id}:${form}`;
