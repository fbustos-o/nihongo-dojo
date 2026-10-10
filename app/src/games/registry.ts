import { lazy, type ComponentType } from 'react';
import { GAME_IDS, type GameId } from '../domain/schema';
import type { GameProps } from './types';

const LOADERS: Partial<Record<GameId, () => Promise<{ default: ComponentType<GameProps> }>>> = {
  'kana-recognize': () => import('./kana-recognize').then((m) => ({ default: m.KanaRecognize })),
  'kana-write': () => import('./kana-write').then((m) => ({ default: m.KanaWrite })),
  'read-words': () => import('./read-words').then((m) => ({ default: m.ReadWords })),
  'listen': () => import('./listen').then((m) => ({ default: m.Listen })),
  'syntax': () => import('./syntax').then((m) => ({ default: m.Syntax })),
  'particles': () => import('./particles').then((m) => ({ default: m.Particles })),
  'conjugation': () => import('./conjugation').then((m) => ({ default: m.Conjugation })),
  'numbers': () => import('./numbers').then((m) => ({ default: m.Numbers })),
  'clock': () => import('./clock').then((m) => ({ default: m.Clock })),
  'calendar': () => import('./calendar').then((m) => ({ default: m.Calendar })),
  'dialogues': () => import('./dialogues').then((m) => ({ default: m.Dialogues })),
  'mini-reading': () => import('./mini-reading').then((m) => ({ default: m.MiniReading })),
  'kanji': () => import('./kanji').then((m) => ({ default: m.KanjiGame })),
};

/** Lazy game component: each game is its own chunk, loaded when it is first played (render inside <Suspense>). */
const lazyGame = (load: () => Promise<{ default: ComponentType<GameProps> }>) => lazy(load);

/** Starts downloading a game's chunk (e.g. while the lesson intro is shown). */
export const preloadGame = (id: GameId): Promise<unknown> => (LOADERS[id]?.() ?? Promise.resolve()).catch(() => undefined);

export interface GameMeta {
  id: GameId;
  /** Spanish display name. */
  name: string;
  /** One-line Spanish description. */
  description: string;
  /** Missing until the game is built: the lesson map then shows "próximamente". */
  component?: ComponentType<GameProps>;
}

export const GAME_REGISTRY: Record<GameId, GameMeta> = {
  'kana-recognize': { id: 'kana-recognize', name: 'Reconocer kana', description: 'Mira el kana y escribe su romaji.', component: lazyGame(LOADERS['kana-recognize']!) },
  'kana-write': { id: 'kana-write', name: 'Escribir kana', description: 'Lee el romaji y escríbelo en kana.', component: lazyGame(LOADERS['kana-write']!) },
  'read-words': { id: 'read-words', name: 'Leer palabras', description: 'Lee la palabra y elige o escribe su significado / lectura.', component: lazyGame(LOADERS['read-words']!) },
  listen: { id: 'listen', name: 'Escuchar', description: 'Escucha el audio y elige lo que oíste.', component: lazyGame(LOADERS['listen']!) },
  syntax: { id: 'syntax', name: 'Sintaxis', description: 'Ordena la frase japonesa (sujeto, objeto, verbo).', component: lazyGame(LOADERS['syntax']!) },
  particles: { id: 'particles', name: 'Partículas', description: 'Completa la frase con la partícula correcta.', component: lazyGame(LOADERS['particles']!) },
  conjugation: { id: 'conjugation', name: 'Conjugación', description: 'Conjuga verbos y adjetivos.', component: lazyGame(LOADERS['conjugation']!) },
  numbers: { id: 'numbers', name: 'Números y precios', description: 'Lee números, contadores y precios.', component: lazyGame(LOADERS['numbers']!) },
  clock: { id: 'clock', name: 'Reloj', description: 'Di qué hora marca el reloj.', component: lazyGame(LOADERS['clock']!) },
  calendar: { id: 'calendar', name: 'Calendario', description: 'Fechas y días de la semana.', component: lazyGame(LOADERS['calendar']!) },
  dialogues: { id: 'dialogues', name: 'Diálogos', description: 'Elige la respuesta correcta en una conversación.', component: lazyGame(LOADERS['dialogues']!) },
  'mini-reading': { id: 'mini-reading', name: 'Mini-lectura', description: 'Lee un texto corto y responde.', component: lazyGame(LOADERS['mini-reading']!) },
  kanji: { id: 'kanji', name: 'Kanji', description: 'Kanji: significado, lectura en palabras reales y frases que se transforman.', component: lazyGame(LOADERS['kanji']!) },
};

export const getGame = (id: GameId): GameMeta => GAME_REGISTRY[id];
export const isImplemented = (id: GameId): boolean => GAME_REGISTRY[id].component !== undefined;
export const implementedGameIds = (): GameId[] => GAME_IDS.filter(isImplemented);
