import type { SentencePattern } from '../../domain/schema';
import { shuffle } from '../kanaUtils';
import { BASE_PARTICLES, examplesOf, tokenize, type PatternExample } from '../syntax/syntaxLogic';

/** Particles that can be blanked (the ten of the game plus や). */
const BLANKABLE = new Set<string>([...BASE_PARTICLES, 'や']);

/** One-line Spanish explanation of what each particle does. */
export const PARTICLE_EXPLANATIONS: Record<string, string> = {
  は: 'は marca el tema de la frase (de qué o de quién hablo). Se escribe は pero se lee «wa».',
  を: 'を marca el objeto directo: lo que recibe la acción del verbo. Se lee «o».',
  に: 'に marca el destino o la dirección (con ikimasu), la hora puntual y el lugar donde algo está.',
  で: 'で marca el lugar donde se hace la acción y también el medio (en autobús, con palillos).',
  へ: 'へ marca la dirección del movimiento (a). Se escribe へ pero se lee «e».',
  も: 'も significa «también» y sustituye a は o を.',
  の: 'の une dos sustantivos: posesión o pertenencia («de»).',
  と: 'と significa «con» (compañía) o «y» entre sustantivos.',
  が: 'が marca el sujeto, sobre todo con あります / います, すき y las preguntas con palabra interrogativa.',
  か: 'か al final de la frase la convierte en pregunta.',
  や: 'や enumera ejemplos entre sustantivos («A, B y otras cosas»).',
};

export interface Blank {
  /** Tokens of the sentence. */
  tokens: string[];
  /** Index (in `tokens`) of the blanked particle. */
  at: number;
  answer: string;
}

/** Positions of blankable particles in a sentence. */
export function blankablePositions(tokens: readonly string[]): number[] {
  return tokens.flatMap((t, i) => (BLANKABLE.has(t) && i > 0 ? [i] : []));
}

/** Blanks one particle (random among the candidates), or null when there is none. */
export function makeBlank(ja: string, rng: () => number = Math.random): Blank | null {
  const tokens = tokenize(ja);
  const positions = blankablePositions(tokens);
  if (positions.length === 0) return null;
  const at = positions[Math.floor(rng() * positions.length)]!;
  return { tokens, at, answer: tokens[at]! };
}

/**
 * Particles that could also be grammatical where the answer goes, so they are never offered as distractors
 * (QA-011): に/へ/と/で overlap with あいます / いきます / いる; は/が/も/を swap on a noun (すき, あります).
 */
const INTERCHANGEABLE: Record<string, string[]> = {
  に: ['へ', 'と', 'で'],
  へ: ['に', 'で'],
  で: ['に', 'へ'],
  と: ['に', 'や', 'も'],
  や: ['と'],
  は: ['が', 'も', 'を'],
  が: ['は', 'も', 'を'],
  も: ['は', 'が', 'を'],
  を: ['も', 'が', 'は'],
};

/** The right particle plus three distractors that cannot also be right, shuffled. */
export function particleOptions(answer: string, count = 4, rng: () => number = Math.random): string[] {
  const banned = new Set([answer, ...(INTERCHANGEABLE[answer] ?? [])]);
  const others = shuffle(
    BASE_PARTICLES.filter((p) => !banned.has(p)),
    rng,
  ).slice(0, count - 1);
  return shuffle([answer, ...others], rng);
}

export interface ParticleEntry {
  id: string;
  pattern: SentencePattern;
  example: PatternExample;
}

/** Examples that have at least one particle to blank. */
export function particleEntries(patterns: readonly SentencePattern[]): ParticleEntry[] {
  return patterns.flatMap((pattern) =>
    examplesOf(pattern).flatMap((example, index) =>
      blankablePositions(tokenize(example.ja)).length > 0 ? [{ id: `particle:${pattern.id}:${index}`, pattern, example }] : [],
    ),
  );
}
