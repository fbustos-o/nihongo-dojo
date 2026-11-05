import type { Content } from '../domain/contentLoader';
import { glosses, lineTranslation, exampleTranslation, patternTitle, dialogueTitle } from '../domain/glosses';
import { getLang, getMeaningLang, localeOf, t } from '../i18n';
import { monthName, weekdayName } from '../i18n/dates';
import type { RenderableWord } from '../domain/renderPlan';
import {
  adjFormLabel,
  conjugateIAdjective,
  conjugateNaAdjective,
  conjugateNoun,
  type IAdjFormId,
  type NaAdjFormId,
  type NounFormId,
} from '../engine/adjectives';
import { conjugateVerb, verbFormLabel, type VerbFormId, type VerbGroup } from '../engine/conjugate';
import { readCounter, readDate, readNumber, readTime, type Counter } from '../engine/numbers';
import { isBurned, NEVER_DUE, STAGE_INTERVAL_MS, stageGroupName, stageName } from '../engine/srs';
import type { ItemState } from '../state/progressSchema';
import { classifyItem, dialogueIdOf, patternIdOf, SRS_GROUPS, type ReviewCategory, type SrsGroup } from './reviewLogic';

/** URL slug of an SRS group: `Aprendiz` -> `aprendiz`. */
export const groupSlug = (group: SrsGroup): string => group.toLowerCase();

export function groupFromSlug(slug: string | undefined): SrsGroup | null {
  return SRS_GROUPS.find((g) => groupSlug(g) === slug) ?? null;
}

/** SRS group of a stage. Stage 0 (answered wrong while new) counts as Aprendiz, like the dashboard. */
export function srsGroupOfStage(stage: number): SrsGroup {
  const name = stageGroupName(stage);
  return (name === 'Nuevo' ? 'Aprendiz' : name) as SrsGroup;
}

export const CATEGORY_ORDER: ReviewCategory[] = ['kana', 'kanji', 'word', 'conjugation', 'number', 'clock', 'calendar', 'syntax', 'particle', 'dialogue'];

/** Display name of an item type in the interface language. */
export const categoryLabel = (category: ReviewCategory): string => t(`memory.cat.${category}`);

/** How an item is shown in the memory list. */
export interface ItemLabel {
  /** Plain text name (used for sorting, accessible names and as fallback). */
  text: string;
  /** Render with JaText (vocabulary and kana, which honour the learner's unlocks). */
  ja?: RenderableWord;
  /** `text` itself is Japanese (kanji characters, sentences). */
  textIsJa?: boolean;
  /** Meaning / form / context, in the meaning language. */
  detail?: string;
  /** Kana reading shown next to a number, time or date. */
  reading?: string;
}

export interface Lookup {
  vocab: Map<string, Content['vocab'][number]>;
  patterns: Map<string, Content['patterns'][number]>;
  dialogues: Map<string, Content['dialogues'][number]>;
}

export function buildLookup(c: Pick<Content, 'vocab' | 'patterns' | 'dialogues'>): Lookup {
  return {
    vocab: new Map(c.vocab.map((w) => [w.id, w])),
    patterns: new Map(c.patterns.map((p) => [p.id, p])),
    dialogues: new Map(c.dialogues.map((d) => [d.id, d])),
  };
}

const counterName = (counter: string | undefined): string => {
  const key = `memory.counter.${counter}`;
  const text = t(key);
  return text === key ? String(counter) : text;
};

const unknown = (id: string): ItemLabel => ({ text: id });

function conjugationLabel(id: string, lookup: Lookup): ItemLabel {
  const [category, wordId, form] = id.split(':');
  const word = lookup.vocab.get(wordId ?? '');
  if (!word || !form) return unknown(id);
  try {
    let kana: string;
    let label: string;
    if (category === 'verb') {
      kana = conjugateVerb(word.kana, (word.verbGroup ?? 'u') as VerbGroup)[form as VerbFormId].kana;
      label = verbFormLabel(form as VerbFormId).label;
    } else {
      kana =
        category === 'iadj'
          ? conjugateIAdjective(word.kana)[form as IAdjFormId].kana
          : category === 'naadj'
            ? conjugateNaAdjective(word.kana)[form as NaAdjFormId].kana
            : conjugateNoun(word.kana)[form as NounFormId].kana;
      label = adjFormLabel(form as IAdjFormId).label;
    }
    return { text: kana, ja: { kana }, detail: `${glosses(word, getMeaningLang())[0] ?? word.kana} · ${label}` };
  } catch {
    return unknown(id);
  }
}

function wordLabel(id: string, lookup: Lookup): ItemLabel {
  const kanjiGame = id.endsWith(':kanji');
  const word = lookup.vocab.get(kanjiGame ? id.slice(0, -':kanji'.length) : id);
  if (!word) return unknown(id);
  const meaning = glosses(word, getMeaningLang()).join(', ');
  return { text: word.kanji ?? word.kana, ja: word, detail: kanjiGame ? t('memory.inKanjiGame', { meaning }) : meaning };
}

function numberLabel(id: string): ItemLabel {
  try {
    if (id.startsWith('number:')) {
      const n = Number(id.slice('number:'.length));
      return { text: String(n), reading: readNumber(n).kana };
    }
    const [, counter, n] = id.split(':');
    const count = Number(n);
    return { text: `${count} (${counterName(counter)})`, reading: readCounter(count, counter as Counter).kana };
  } catch {
    return unknown(id);
  }
}

function timeLabel(id: string): ItemLabel {
  const [, h, m] = id.split(':');
  try {
    return { text: `${h}:${String(m).padStart(2, '0')}`, reading: readTime(Number(h), Number(m)).kana };
  } catch {
    return unknown(id);
  }
}

function dateLabel(id: string): ItemLabel {
  const parts = id.split(':');
  try {
    if (parts[1] === 'wd') {
      const weekday = weekdayName(Number(parts[2]));
      return { text: t(parts[3] === 'prev' ? 'memory.dayBefore' : 'memory.dayAfter', { weekday }), detail: t('memory.weekdayDetail') };
    }
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    const text = t('memory.dateLabel', { day, month: monthName(month) });
    if (parts[3] === 'wd') return { text, detail: t('memory.weekdayOfDate') };
    return { text, reading: readDate(month, day).kana };
  } catch {
    return unknown(id);
  }
}

function patternLabel(id: string, lookup: Lookup): ItemLabel {
  const pattern = lookup.patterns.get(patternIdOf(id));
  const example = pattern?.examples?.[Number(id.slice(id.lastIndexOf(':') + 1))];
  if (!pattern) return unknown(id);
  if (!example) return { text: patternTitle(pattern, getLang()), detail: t('memory.patternDetail') };
  return { text: example.ja, textIsJa: true, detail: `${exampleTranslation(example, getMeaningLang())} · ${patternTitle(pattern, getLang())}` };
}

function dialogueLabel(id: string, lookup: Lookup): ItemLabel {
  const dialogue = lookup.dialogues.get(dialogueIdOf(id));
  const line = dialogue?.lines[Number(id.slice(id.lastIndexOf(':') + 1))];
  if (!dialogue || !line) return unknown(id);
  return { text: line.ja, textIsJa: true, detail: `${lineTranslation(line, getMeaningLang())} · ${dialogueTitle(dialogue, getLang())}` };
}

/** Readable label of any progress item (every id convention of `reviewLogic.classifyItem`). */
export function itemLabel(item: Pick<ItemState, 'kind' | 'itemId'>, lookup: Lookup, kanaRomaji: ReadonlyMap<string, string> = new Map()): ItemLabel {
  const id = item.itemId;
  switch (classifyItem(item)) {
    case 'kana':
      return { text: id, ja: { kana: id }, detail: kanaRomaji.get(id) };
    case 'kanji':
      return item.kind === 'kanji' ? { text: id, textIsJa: true } : wordLabel(id, lookup);
    case 'word':
      return wordLabel(id, lookup);
    case 'conjugation':
      return conjugationLabel(id, lookup);
    case 'number':
      return numberLabel(id);
    case 'clock':
      return timeLabel(id);
    case 'calendar':
      return dateLabel(id);
    case 'syntax':
    case 'particle':
      return patternLabel(id, lookup);
    case 'dialogue':
      return dialogueLabel(id, lookup);
  }
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const plural = (n: number, unit: 'hour' | 'day' | 'week' | 'month' | 'year'): string => t(n === 1 ? `memory.${unit}1` : `memory.${unit}N`, { n });

const startOfDay = (ms: number): number => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** Relative time of the next review: "vencido", "en 3 h", "mañana", "en 5 días", "nunca" (or the English equivalents). */
export function relativeTime(nextDue: number, now: number, burned = false): string {
  if (burned || nextDue >= NEVER_DUE) return t('memory.never');
  if (nextDue <= now) return t('memory.overdue');
  const diff = nextDue - now;
  if (diff < HOUR) return t('memory.inMin', { n: Math.max(1, Math.round(diff / MINUTE)) });
  if (diff < DAY) return t('memory.inHours', { n: Math.round(diff / HOUR) });
  const days = Math.round((startOfDay(nextDue) - startOfDay(now)) / DAY);
  if (days <= 1) return t('memory.tomorrow');
  if (days < 60) return t('memory.inDays', { n: days });
  if (days < 365) return t('memory.in', { text: plural(Math.round(days / 30), 'month') });
  return t('memory.in', { text: plural(Math.round(days / 365), 'year') });
}

/** Absolute date of the next review for hover / tap. */
export function absoluteDate(nextDue: number, burned = false): string {
  if (burned || nextDue >= NEVER_DUE) return t('memory.noMore');
  return new Date(nextDue).toLocaleString(localeOf(getLang()), { dateStyle: 'full', timeStyle: 'short' });
}

/** Correct answers over all answers, as a whole percent; null when never answered. */
export function accuracyPct(item: Pick<ItemState, 'correct' | 'wrong'>): number | null {
  const total = item.correct + item.wrong;
  return total === 0 ? null : Math.round((item.correct / total) * 100);
}

/** Human interval for the help text: "4 horas", "1 día", "2 semanas", "4 meses". */
export function formatInterval(ms: number): string {
  const hours = ms / HOUR;
  if (hours < 24) return plural(hours, 'hour');
  const days = hours / 24;
  if (days < 7) return plural(days, 'day');
  if (days < 30) return plural(Math.round(days / 7), 'week');
  return plural(Math.round(days / 30), 'month');
}

export interface StageHelpRow {
  stage: number;
  name: string;
  /** Wait before the next review once this stage is reached; null = never reviewed again. */
  interval: string | null;
}

/** Stages 1..9 with their intervals, read from `STAGE_INTERVAL_MS`. */
export function stageHelpRows(): StageHelpRow[] {
  return STAGE_INTERVAL_MS.map((ms, stage) => ({ stage, name: stageName(stage), interval: ms === null ? null : formatInterval(ms) })).filter((r) => r.stage > 0);
}

export interface MemoryRow {
  item: ItemState;
  category: ReviewCategory;
  label: ItemLabel;
  stageName: string;
  accuracy: number | null;
  burned: boolean;
}

/** Items of one SRS group, with their label already resolved. */
export function memoryRows(items: Readonly<Record<string, ItemState>>, group: SrsGroup, lookup: Lookup, kanaRomaji?: ReadonlyMap<string, string>): MemoryRow[] {
  return Object.values(items)
    .filter((item) => srsGroupOfStage(item.srsStage) === group)
    .map((item) => ({
      item,
      category: classifyItem(item),
      label: itemLabel(item, lookup, kanaRomaji),
      stageName: stageName(item.srsStage),
      accuracy: accuracyPct(item),
      burned: isBurned(item.srsStage),
    }));
}

export type MemorySort = 'next' | 'accuracy' | 'name';
export const SORT_ORDER: MemorySort[] = ['next', 'accuracy', 'name'];
export const sortLabel = (sort: MemorySort): string => t(`memory.sort.${sort}`);

export type MemoryFilter = ReviewCategory | 'all';

/** Filters by type and sorts. Pure; returns a new array. */
export function sortAndFilter(rows: readonly MemoryRow[], sort: MemorySort, filter: MemoryFilter = 'all'): MemoryRow[] {
  const out = rows.filter((r) => filter === 'all' || r.category === filter);
  const byName = (a: MemoryRow, b: MemoryRow) => a.label.text.localeCompare(b.label.text, 'ja') || a.item.itemId.localeCompare(b.item.itemId);
  switch (sort) {
    case 'next':
      return out.sort((a, b) => a.item.nextDue - b.item.nextDue || byName(a, b));
    case 'accuracy':
      return out.sort((a, b) => (a.accuracy ?? 101) - (b.accuracy ?? 101) || byName(a, b));
    case 'name':
      return out.sort(byName);
  }
}

/** Number of rows per type (for the filter menu). */
export function categoryCounts(rows: readonly MemoryRow[]): Partial<Record<ReviewCategory, number>> {
  const counts: Partial<Record<ReviewCategory, number>> = {};
  for (const r of rows) counts[r.category] = (counts[r.category] ?? 0) + 1;
  return counts;
}
