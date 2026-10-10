import { makeReading, type Reading } from './reading';

export const I_ADJ_FORM_IDS = [
  'dictionary',
  'present',
  'past',
  'negative',
  'negativePast',
  'adverb',
  'te',
  'plainPast',
  'plainNegative',
  'plainNegativePast',
] as const;
export type IAdjFormId = (typeof I_ADJ_FORM_IDS)[number];
export type IAdjForms = Record<IAdjFormId, Reading>;

export const NA_ADJ_FORM_IDS = [
  'present',
  'past',
  'negative',
  'negativePast',
  'adverb',
  'te',
  'attributive',
] as const;
export type NaAdjFormId = (typeof NA_ADJ_FORM_IDS)[number];
export type NaAdjForms = Record<NaAdjFormId, Reading>;

export const NOUN_FORM_IDS = ['present', 'past', 'negative', 'negativePast'] as const;
export type NounFormId = (typeof NOUN_FORM_IDS)[number];
export type NounForms = Record<NounFormId, Reading>;

export interface AdjFormLabel {
  label: string;
  explanation: string;
}

export const ADJ_FORM_LABELS_ES: Record<IAdjFormId | NaAdjFormId | NounFormId, AdjFormLabel> = {
  dictionary: { label: 'Forma diccionario', explanation: 'El adjetivo sin です (おいしい).' },
  present: { label: 'Presente (です)', explanation: 'Afirmativo en presente, cortés (おいしいです / きれいです / がくせいです).' },
  past: { label: 'Pasado (でした / かったです)', explanation: 'Afirmativo en pasado, cortés (おいしかったです / きれいでした).' },
  negative: { label: 'Negativo (くないです / じゃないです)', explanation: 'Negativo en presente, cortés (おいしくないです / きれいじゃないです).' },
  negativePast: { label: 'Negativo pasado', explanation: 'Negativo en pasado, cortés (おいしくなかったです / きれいじゃなかったです).' },
  adverb: { label: 'Adverbio (く / に)', explanation: 'Convierte el adjetivo en adverbio (おいしく / きれいに).' },
  te: { label: 'Forma て (くて / で)', explanation: 'Enlaza adjetivos o frases (おいしくて / きれいで).' },
  attributive: { label: 'Antes de un sustantivo (な)', explanation: 'Los adjetivos な llevan な delante del sustantivo (きれいな ひと).' },
  plainPast: { label: 'Pasado plano', explanation: 'Pasado sin です (おいしかった).' },
  plainNegative: { label: 'Negativo plano', explanation: 'Negativo sin です (おいしくない).' },
  plainNegativePast: { label: 'Negativo pasado plano', explanation: 'Negativo pasado sin です (おいしくなかった).' },
};

/** Stem of an い-adjective; いい is the irregular よい (よかった, よくない). */
export function iAdjStem(dict: string): string {
  if (dict.length < 2 || !dict.endsWith('い')) throw new Error(`An い-adjective must end in い: ${dict}`);
  // いい itself and compounds (かっこいい, ねつがいい…) use よ- for every inflection except the dictionary form.
  if (dict.endsWith('いい')) return dict.slice(0, -2) + 'よ';
  return dict.slice(0, -1);
}

/** Conjugates an い-adjective written in kana (たかい, おいしい, いい). */
export function conjugateIAdjective(dict: string): IAdjForms {
  const stem = iAdjStem(dict);
  const kana: Record<IAdjFormId, string> = {
    dictionary: dict,
    present: `${dict}です`,
    past: `${stem}かったです`,
    negative: `${stem}くないです`,
    negativePast: `${stem}くなかったです`,
    adverb: `${stem}く`,
    te: `${stem}くて`,
    plainPast: `${stem}かった`,
    plainNegative: `${stem}くない`,
    plainNegativePast: `${stem}くなかった`,
  };
  const result = {} as IAdjForms;
  for (const id of I_ADJ_FORM_IDS) result[id] = makeReading(kana[id]);
  return result;
}

/** ではない is the formal variant of じゃない, accepted as an alternative. */
function copulaForms(base: string): Record<'present' | 'past' | 'negative' | 'negativePast', Reading> {
  return {
    present: makeReading(`${base}です`),
    past: makeReading(`${base}でした`),
    negative: makeReading(`${base}じゃないです`, [`${base}ではないです`, `${base}じゃありません`, `${base}ではありません`]),
    negativePast: makeReading(`${base}じゃなかったです`, [
      `${base}ではなかったです`,
      `${base}じゃありませんでした`,
      `${base}ではありませんでした`,
    ]),
  };
}

/** Conjugates a な-adjective written in kana (きれい, しずか). The な is not part of the input. */
export function conjugateNaAdjective(dict: string): NaAdjForms {
  if (!dict) throw new Error('Empty adjective');
  const base = copulaForms(dict);
  return {
    ...base,
    adverb: makeReading(`${dict}に`),
    te: makeReading(`${dict}で`),
    attributive: makeReading(`${dict}な`),
  };
}

/** Noun + です in the four tenses (がくせい -> がくせいです, がくせいじゃないです…). */
export function conjugateNoun(noun: string): NounForms {
  if (!noun) throw new Error('Empty noun');
  return copulaForms(noun);
}
