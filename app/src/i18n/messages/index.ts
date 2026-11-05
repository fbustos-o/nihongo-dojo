import { about } from './about';
import { common } from './common';
import { games } from './games';
import { home } from './home';
import { lesson } from './lesson';
import { memory } from './memory';
import { practice } from './practice';
import { review } from './review';
import { settings } from './settings';

/**
 * Register every message area here. Each area is `{ es: Record<key, string>, en: Record<key, string> }` with
 * identical keys. Areas are merged into one flat dictionary per language; keys must be unique across areas.
 */
export const AREAS = { common, home, lesson, games, review, settings, about, memory, practice } as const;

type AreaKeys<A> = A extends { es: infer M } ? keyof M : never;
export type MessageKey = { [K in keyof typeof AREAS]: AreaKeys<(typeof AREAS)[K]> }[keyof typeof AREAS];

function merge(lang: 'es' | 'en'): Record<string, string> {
  const out: Record<string, string> = {};
  for (const area of Object.values(AREAS)) Object.assign(out, area[lang]);
  return out;
}

export const MESSAGES: Record<'es' | 'en', Record<string, string>> = { es: merge('es'), en: merge('en') };
