import type { ComponentType } from 'react';
import { GAME_IDS, type GameId } from '../domain/schema';
import { KanaRecognize } from './kana-recognize';
import { KanaWrite } from './kana-write';
import { Listen } from './listen';
import { ReadWords } from './read-words';
import type { GameProps } from './types';

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
  'kana-recognize': { id: 'kana-recognize', name: 'Reconocer kana', description: 'Mira el kana y escribe su romaji.', component: KanaRecognize },
  'kana-write': { id: 'kana-write', name: 'Escribir kana', description: 'Lee el romaji y escríbelo en kana.', component: KanaWrite },
  'read-words': { id: 'read-words', name: 'Leer palabras', description: 'Lee la palabra y elige o escribe su significado / lectura.', component: ReadWords },
  listen: { id: 'listen', name: 'Escuchar', description: 'Escucha el audio y elige lo que oíste.', component: Listen },
  syntax: { id: 'syntax', name: 'Sintaxis', description: 'Ordena la frase japonesa (sujeto, objeto, verbo).' },
  particles: { id: 'particles', name: 'Partículas', description: 'Completa la frase con la partícula correcta.' },
  conjugation: { id: 'conjugation', name: 'Conjugación', description: 'Conjuga verbos y adjetivos.' },
  numbers: { id: 'numbers', name: 'Números y precios', description: 'Lee números, contadores y precios.' },
  clock: { id: 'clock', name: 'Reloj', description: 'Di qué hora marca el reloj.' },
  calendar: { id: 'calendar', name: 'Calendario', description: 'Fechas y días de la semana.' },
  dialogues: { id: 'dialogues', name: 'Diálogos', description: 'Elige la respuesta correcta en una conversación.' },
  'mini-reading': { id: 'mini-reading', name: 'Mini-lectura', description: 'Lee un texto corto y responde.' },
  kanji: { id: 'kanji', name: 'Kanji', description: 'Lee el kanji en palabras reales.' },
};

export const getGame = (id: GameId): GameMeta => GAME_REGISTRY[id];
export const isImplemented = (id: GameId): boolean => GAME_REGISTRY[id].component !== undefined;
export const implementedGameIds = (): GameId[] => GAME_IDS.filter(isImplemented);
