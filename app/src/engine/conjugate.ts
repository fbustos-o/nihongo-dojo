import { makeReading, type Reading } from './reading';

export type VerbGroup = 'u' | 'ru' | 'irregular';

export const VERB_FORM_IDS = [
  'dictionary',
  'masu',
  'masen',
  'mashita',
  'masendeshita',
  'mashou',
  'mashouka',
  'masenka',
  'taidesu',
  'takunaidesu',
  'te',
  'tekudasai',
  'teimasu',
  'temoiidesu',
  'tehaikemasen',
  'nai',
  'ta',
  'nakatta',
] as const;
export type VerbFormId = (typeof VERB_FORM_IDS)[number];

export type VerbForms = Record<VerbFormId, Reading>;

export interface FormLabel {
  /** Short Spanish name of the form. */
  label: string;
  /** One-line Spanish explanation with an example ending. */
  explanation: string;
}

export const FORM_LABELS_ES: Record<VerbFormId, FormLabel> = {
  dictionary: { label: 'Forma diccionario', explanation: 'La forma básica del verbo, la que aparece en el diccionario (たべる).' },
  masu: { label: 'ます (presente / futuro, cortés)', explanation: 'Presente y futuro afirmativo en estilo cortés (たべます).' },
  masen: { label: 'ません (negativo, cortés)', explanation: 'Presente y futuro negativo en estilo cortés (たべません).' },
  mashita: { label: 'ました (pasado, cortés)', explanation: 'Pasado afirmativo en estilo cortés (たべました).' },
  masendeshita: { label: 'ませんでした (pasado negativo, cortés)', explanation: 'Pasado negativo en estilo cortés (たべませんでした).' },
  mashou: { label: 'ましょう (invitación)', explanation: 'Propuesta: "hagamos…" (たべましょう).' },
  mashouka: { label: 'ましょうか (¿lo hacemos? / ¿te ofrezco…?)', explanation: 'Ofrecimiento o propuesta en forma de pregunta (たべましょうか).' },
  masenka: { label: 'ませんか (¿no quieres…?)', explanation: 'Invitación amable en forma de pregunta negativa (たべませんか).' },
  taidesu: { label: 'たいです (quiero…)', explanation: 'Deseo de hacer la acción: raíz ます + たいです (たべたいです).' },
  takunaidesu: { label: 'たくないです (no quiero…)', explanation: 'Negativo de たい: raíz ます + たくないです (たべたくないです).' },
  te: { label: 'Forma て', explanation: 'Forma de enlace; base de muchas construcciones (たべて).' },
  tekudasai: { label: 'てください (por favor…)', explanation: 'Petición cortés: forma て + ください (たべてください).' },
  teimasu: { label: 'ています (está …ndo / estado)', explanation: 'Acción en curso o estado resultante: forma て + います (たべています).' },
  temoiidesu: { label: 'てもいいです (se puede…)', explanation: 'Permiso: forma て + もいいです (たべてもいいです).' },
  tehaikemasen: { label: 'てはいけません (no se debe…)', explanation: 'Prohibición: forma て + はいけません (たべてはいけません).' },
  nai: { label: 'Forma ない (negativo, plano)', explanation: 'Negativo en estilo plano o informal (たべない).' },
  ta: { label: 'Forma た (pasado, plano)', explanation: 'Pasado afirmativo en estilo plano (たべた).' },
  nakatta: { label: 'Forma なかった (pasado negativo, plano)', explanation: 'Pasado negativo en estilo plano (たべなかった).' },
};

/** Row mapping of u-verb endings: dictionary ending -> [a-row, i-row]. */
const U_ENDINGS: Record<string, { a: string; i: string }> = {
  う: { a: 'わ', i: 'い' },
  く: { a: 'か', i: 'き' },
  ぐ: { a: 'が', i: 'ぎ' },
  す: { a: 'さ', i: 'し' },
  つ: { a: 'た', i: 'ち' },
  ぬ: { a: 'な', i: 'に' },
  ぶ: { a: 'ば', i: 'び' },
  む: { a: 'ま', i: 'み' },
  る: { a: 'ら', i: 'り' },
};

/** Honorific verbs whose ます stem is い, not り (いらっしゃいます). */
const HONORIFIC_I_STEM = ['いらっしゃる', 'おっしゃる', 'くださる', 'なさる', 'ござる'];

function irregularKind(dict: string): 'suru' | 'kuru' | null {
  if (dict.endsWith('する')) return 'suru';
  if (dict === 'くる' || isKuruCompound(dict)) return 'kuru';
  return null;
}

/** Compounds like もってくる / つれてくる (…てくる, …でくる); not e.g. ふくる. */
function isKuruCompound(dict: string): boolean {
  return /[てで]くる$/.test(dict);
}

function validate(dict: string, group: VerbGroup): void {
  if (dict.length === 0) throw new Error('Empty verb');
  const last = dict.slice(-1);
  if (group === 'irregular') {
    if (!irregularKind(dict)) throw new Error(`Not an irregular verb (する / くる): ${dict}`);
    return;
  }
  if (group === 'ru') {
    if (last !== 'る' || dict.length < 2) throw new Error(`A ru-verb must end in る: ${dict}`);
    return;
  }
  if (!(last in U_ENDINGS)) throw new Error(`A u-verb must end in う/く/ぐ/す/つ/ぬ/ぶ/む/る: ${dict}`);
}

/** Stem used before ます / たい (the "ます-stem"). */
export function masuStem(dict: string, group: VerbGroup): string {
  validate(dict, group);
  const head = dict.slice(0, -1);
  const kind = group === 'irregular' ? irregularKind(dict) : null;
  if (kind === 'suru') return dict.slice(0, -2) + 'し';
  if (kind === 'kuru') return dict.slice(0, -2) + 'き';
  if (group === 'ru') return head;
  if (HONORIFIC_I_STEM.includes(dict)) return head + 'い';
  return head + U_ENDINGS[dict.slice(-1)]!.i;
}

/** The て-form in kana. */
export function teForm(dict: string, group: VerbGroup): string {
  validate(dict, group);
  const head = dict.slice(0, -1);
  if (group === 'irregular') return masuStem(dict, group) + 'て';
  if (group === 'ru') return head + 'て';
  // Exception: 行く / いく (and compounds such as もっていく) -> いって.
  if (dict.endsWith('いく')) return head + 'って';
  switch (dict.slice(-1)) {
    case 'う':
    case 'つ':
    case 'る':
      return head + 'って';
    case 'む':
    case 'ぶ':
    case 'ぬ':
      return head + 'んで';
    case 'く':
      return head + 'いて';
    case 'ぐ':
      return head + 'いで';
    default: // す
      return head + 'して';
  }
}

/** The plain negative (ない form). ある -> ない. */
export function plainNegative(dict: string, group: VerbGroup): string {
  validate(dict, group);
  const head = dict.slice(0, -1);
  const kind = group === 'irregular' ? irregularKind(dict) : null;
  if (kind === 'suru') return dict.slice(0, -2) + 'しない';
  if (kind === 'kuru') return dict.slice(0, -2) + 'こない';
  if (group === 'ru') return head + 'ない';
  if (dict === 'ある') return 'ない';
  return head + U_ENDINGS[dict.slice(-1)]!.a + 'ない';
}

/** て -> た, で -> だ. */
const teToTa = (te: string): string => te.slice(0, -1) + (te.endsWith('で') ? 'だ' : 'た');

/**
 * Conjugates a dictionary-form verb written in kana.
 * @param dict dictionary form in kana (たべる, のむ, べんきょうする, くる…)
 * @param group 'u' (group I), 'ru' (group II) or 'irregular' (group III: する, くる, Xする)
 */
export function conjugateVerb(dict: string, group: VerbGroup): VerbForms {
  const stem = masuStem(dict, group);
  const te = teForm(dict, group);
  const nai = plainNegative(dict, group);
  const naiStem = nai.slice(0, -1); // ...な
  const kana: Record<VerbFormId, string> = {
    dictionary: dict,
    masu: `${stem}ます`,
    masen: `${stem}ません`,
    mashita: `${stem}ました`,
    masendeshita: `${stem}ませんでした`,
    mashou: `${stem}ましょう`,
    mashouka: `${stem}ましょうか`,
    masenka: `${stem}ませんか`,
    taidesu: `${stem}たいです`,
    takunaidesu: `${stem}たくないです`,
    te,
    tekudasai: `${te}ください`,
    teimasu: `${te}います`,
    temoiidesu: `${te}もいいです`,
    tehaikemasen: `${te}はいけません`,
    nai,
    ta: teToTa(te),
    nakatta: `${naiStem}かった`,
  };
  const result = {} as VerbForms;
  for (const id of VERB_FORM_IDS) result[id] = makeReading(kana[id]);
  return result;
}

/** Convenience: a single form as kana. */
export const conjugateVerbForm = (dict: string, group: VerbGroup, form: VerbFormId): string =>
  conjugateVerb(dict, group)[form].kana;
