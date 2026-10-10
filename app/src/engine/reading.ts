import { toRomaji } from 'wanakana';

/**
 * A reading produced by an engine. `kana` is the primary (teacher / textbook) reading;
 * `alternatives` lists other accepted readings in kana. Games must accept either.
 */
export interface Reading {
  kana: string;
  romaji: string;
  alternatives: string[];
}

/** Builds a Reading; drops duplicates and alternatives equal to the primary. */
export function makeReading(kana: string, alternatives: readonly string[] = []): Reading {
  return {
    kana,
    romaji: toRomaji(kana),
    alternatives: [...new Set(alternatives)].filter((alt) => alt !== kana),
  };
}

/** Every accepted kana string of a reading (primary first). */
export const allReadings = (reading: Reading): string[] => [reading.kana, ...reading.alternatives];
