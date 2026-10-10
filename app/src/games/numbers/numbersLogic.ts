import { readCounter, readCounterQuestion, readNumber, readPrice, type Counter, type Reading } from '../../engine';
import type { ItemKind } from '../../state/progressSchema';
import type { Word } from '../../domain/schema';
import { PRICE_OBJECTS, type PriceObject } from './objects';
import { pickOne, pickWeighted, randInt, type Rng } from './random';

export type NumberMode = 'digits' | 'hear' | 'price' | 'priceHear' | 'counter';

export const MODE_LABELS: Record<NumberMode, string> = {
  digits: 'Cifras → lectura',
  hear: 'Audio → cifras',
  price: 'Precios (いくら)',
  priceHear: 'Precios al oído',
  counter: 'Contadores',
};

/** Item kind stored in the progress store (numbers share the "word" kind; ids are `number:<n>` etc.). */
export const NUMBER_ITEM_KIND: ItemKind = 'word';

/** Difficulty tier of a round: 0 = 0-10, 1 = 11-99, 2 = 100-999, 3 = 1000-99,999. */
export function tierForRound(round: number, rounds?: number): number {
  const per = rounds !== undefined ? Math.max(1, Math.ceil(rounds / 4)) : 4;
  return Math.min(3, Math.floor(round / per));
}

export const TIER_RANGES: readonly (readonly [number, number])[] = [
  [0, 10],
  [11, 99],
  [100, 999],
  [1000, 99999],
];

/** Numbers whose reading is irregular: 300/600/800 (びゃく/ぴゃく), 3000/8000/1000. */
export function isIrregularNumber(n: number): boolean {
  const hundreds = Math.floor(n / 100) % 10;
  if (n >= 100 && [3, 6, 8].includes(hundreds)) return true;
  const thousands = Math.floor(n / 1000) % 10;
  return n >= 1000 && [1, 3, 8].includes(thousands);
}

/** Random number of a tier; irregular hundreds / thousands show up more often. */
export function randomNumber(tier: number, rng: Rng): number {
  const [min, max] = TIER_RANGES[Math.max(0, Math.min(3, tier))]!;
  if (tier === 2 && rng() < 0.5) return pickOne(rng, [3, 6, 8]) * 100 + randInt(rng, 0, 99);
  if (tier === 3 && rng() < 0.4) return pickOne(rng, [1, 3, 8]) * 1000 + randInt(rng, 0, 999) + (rng() < 0.5 ? randInt(rng, 0, 9) * 10000 : 0);
  return randInt(rng, min, max);
}

/** Numbers close to `n` that a learner could confuse it with. */
export function relatedNumbers(n: number, max = 99999): number[] {
  const out = new Set<number>([n + 1, n - 1, n + 10, n - 10, n + 100, n - 100, n * 10 > max ? n : n * 10, Math.floor(n / 10)]);
  const digits = String(n).split('');
  for (let i = 0; i + 1 < digits.length; i++) {
    const swapped = [...digits];
    [swapped[i], swapped[i + 1]] = [swapped[i + 1]!, swapped[i]!];
    out.add(Number(swapped.join('')));
  }
  out.delete(n);
  return [...out].filter((v) => v >= 0 && v <= max);
}

export function formatYen(n: number): string {
  return `¥${n.toLocaleString('en-US')}`;
}

/** Digits typed by the learner: accepts commas, spaces, ¥ / 円 and full-width digits. */
export function parseTypedNumber(input: string): number | null {
  const cleaned = input.normalize('NFKC').replace(/[,\s¥￥円]/g, '');
  return /^\d+$/.test(cleaned) ? Number(cleaned) : null;
}

export interface CounterSpec {
  counter: Counter;
  max: number;
  /** Numbers that are irregular for this counter (shown more often). */
  hot: readonly number[];
  display: (n: number) => string;
}

export const COUNTER_SPECS: readonly CounterSpec[] = [
  { counter: 'tsu', max: 10, hot: [1, 2, 4, 7, 10], display: (n) => `${n} ${n === 1 ? 'cosa' : 'cosas'} (con つ)` },
  { counter: 'nin', max: 10, hot: [1, 2, 4, 7], display: (n) => `${n} ${n === 1 ? 'persona' : 'personas'}` },
  { counter: 'kai', max: 12, hot: [1, 3, 6, 8, 10], display: (n) => `piso ${n} (${n}.º piso)` },
  { counter: 'sai', max: 20, hot: [1, 8, 10, 20], display: (n) => `${n} ${n === 1 ? 'año' : 'años'} de edad` },
];

export type NumberQuestion = {
  mode: NumberMode;
  /** Item id for the picker (not yet prefixed by the kind). */
  id: string;
  /** Progress item id, e.g. `number:416` / `counter:nin:3`. */
  itemId: string;
  label: string;
  /** 'type' = write the kana; 'choice' = pick it; 'digits' = type the number. */
  format: 'type' | 'choice' | 'digits';
  value: number;
  reading: Reading;
  /** Related readings for distractors. */
  related: string[];
  object?: PriceObject;
  counter?: { spec: CounterSpec; n: number };
};

const formatFor = (rng: Rng): 'type' | 'choice' => (rng() < 0.35 ? 'choice' : 'type');

export function makeNumberQuestion(mode: NumberMode, tier: number, rng: Rng): NumberQuestion {
  if (mode === 'counter') {
    const spec = pickOne(rng, COUNTER_SPECS);
    const n = pickWeighted(rng, Array.from({ length: spec.max }, (_, i) => i + 1), (v) => (spec.hot.includes(v) ? 3 : 1));
    const reading = readCounter(n, spec.counter);
    return {
      mode,
      id: `counter:${spec.counter}:${n}`,
      itemId: `counter:${spec.counter}:${n}`,
      label: `${spec.display(n)} → ${reading.kana}`,
      format: formatFor(rng),
      value: n,
      reading,
      related: [n + 1, n - 1, n + 2].filter((v) => v >= 1).map((v) => readCounter(v, spec.counter).kana),
      counter: { spec, n },
    };
  }
  const isPrice = mode === 'price' || mode === 'priceHear';
  let value: number;
  let object: PriceObject | undefined;
  if (isPrice) {
    object = pickOne(rng, PRICE_OBJECTS);
    value = pickOne(rng, object.prices);
  } else {
    value = randomNumber(tier, rng);
  }
  const reading = isPrice ? readPrice(value) : readNumber(value);
  const related = relatedNumbers(value).map((v) => (isPrice ? readPrice(v) : readNumber(v)).kana);
  return {
    mode,
    id: `number:${value}`,
    itemId: `number:${value}`,
    label: `${isPrice ? formatYen(value) : value} → ${reading.kana}`,
    format: mode === 'hear' || mode === 'priceHear' ? 'digits' : formatFor(rng),
    value,
    reading,
    related,
    object,
  };
}

/** The question word for the counter ("なんにん"), for hints. */
export const counterQuestionKana = (counter: Counter): string => readCounterQuestion(counter).kana;

/** Which modes a lesson's words call for; with no words (free practice) everything is available. */
export function availableModes(words: readonly Pick<Word, 'tags'>[]): NumberMode[] {
  const tags = new Set(words.flatMap((w) => w.tags));
  const modes: NumberMode[] = ['digits', 'hear'];
  if (words.length === 0 || ['cosa', 'dinero', 'tienda', 'restaurante'].some((t) => tags.has(t))) modes.push('price', 'priceHear');
  if (words.length === 0 || tags.has('contador')) modes.push('counter');
  return modes;
}

/** Mode weights for the mixed session: counter lessons lean on counters. */
export function modePool(words: readonly Pick<Word, 'tags'>[]): NumberMode[] {
  const modes = availableModes(words);
  const counterLesson = words.some((w) => w.tags.includes('contador'));
  return counterLesson && modes.includes('counter') ? [...modes, 'counter', 'counter'] : modes;
}
