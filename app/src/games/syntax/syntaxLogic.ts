import type { PatternExample, SentencePattern } from '../../domain/schema';
import { shuffle } from '../kanaUtils';

export type { PatternExample };

/** Examples of a pattern (validated content: `SentencePatternSchema.examples`). */
export const examplesOf = (pattern: SentencePattern): PatternExample[] => pattern.examples ?? [];

/** Particles offered as tiles / blanks in the games. */
export const BASE_PARTICLES = ['は', 'を', 'に', 'で', 'へ', 'も', 'の', 'と', 'が', 'か'] as const;
/** Every token that attaches to the noun before it (also from / until / and-etc.). */
const ATTACHING = new Set<string>([...BASE_PARTICLES, 'や', 'から', 'まで']);
/** Sentence-final か (question marker) is a particle too but is kept out of the movable part. */
export const isParticle = (token: string): boolean => ATTACHING.has(token);

/** Drops the final 。？！ and splits the sentence on spaces. */
export function tokenize(ja: string): string[] {
  return ja
    .replace(/[。？！?!]+$/u, '')
    .split(/\s+/u)
    .filter((t) => t !== '');
}

interface Parts {
  /** Movable part, before the predicate. */
  head: string[];
  /** Predicate: everything after the last particle (it must stay at the end). */
  tail: string[];
  /** Sentence-final か. */
  suffix: string[];
}

/** Splits a token list in movable head, fixed predicate and final か. */
function parts(tokens: readonly string[]): Parts {
  let end = tokens.length;
  const suffix: string[] = [];
  if (end > 1 && tokens[end - 1] === 'か') {
    suffix.push('か');
    end -= 1;
  }
  const core = tokens.slice(0, end);
  let lastParticle = -1;
  core.forEach((t, i) => {
    if (isParticle(t)) lastParticle = i;
  });
  return { head: core.slice(0, lastParticle + 1), tail: core.slice(lastParticle + 1), suffix };
}

/** Groups the head into [noun + its particles] chunks, as strings. Null when it does not start with a content word. */
function chunkKeys(head: readonly string[]): string[] | null {
  const chunks: string[][] = [];
  for (const token of head) {
    if (isParticle(token)) {
      if (chunks.length === 0) return null;
      chunks[chunks.length - 1]!.push(token);
    } else chunks.push([token]);
  }
  return chunks.map((c) => c.join(' '));
}

/**
 * Is `answer` an acceptable order for the sentence `solution`? Exact match always is. Otherwise the
 * predicate (everything after the last particle, plus a final か) must stay at the end and the
 * remaining phrases (noun + its particles) may be in any order: each particle stays attached to
 * its noun, so きのう わたし は… and わたし は きのう… are both correct.
 */
export function isValidOrder(solution: readonly string[], answer: readonly string[]): boolean {
  if (solution.length !== answer.length) return false;
  if (solution.every((t, i) => t === answer[i])) return true;
  const s = parts(solution);
  const keysS = chunkKeys(s.head);
  if (!keysS) return false;
  const tailLength = s.tail.length + s.suffix.length;
  const fixed = answer.slice(answer.length - tailLength);
  if (fixed.join(' ') !== [...s.tail, ...s.suffix].join(' ')) return false;
  const keysA = chunkKeys(answer.slice(0, answer.length - tailLength));
  if (!keysA || keysA.length !== keysS.length) return false;
  return [...keysA].sort().join('|') === [...keysS].sort().join('|');
}

export interface Tile {
  id: string;
  text: string;
  particle: boolean;
  /** Distractor particle that is not part of the sentence. */
  distractor: boolean;
}

/** Tiles for a sentence (shuffled) plus 1-2 distractor particles not used by it. */
export function buildTiles(tokens: readonly string[], rng: () => number = Math.random): Tile[] {
  const tiles: Tile[] = tokens.map((text, i) => ({ id: `t${i}`, text, particle: isParticle(text), distractor: false }));
  const unused = shuffle(
    BASE_PARTICLES.filter((p) => !tokens.includes(p)),
    rng,
  );
  const extra = rng() < 0.5 ? 1 : 2;
  unused.slice(0, extra).forEach((text, i) => tiles.push({ id: `d${i}`, text, particle: true, distractor: true }));
  let mixed = shuffle(tiles, rng);
  // Do not hand over the sentence already solved.
  for (let tries = 0; tries < 5 && mixed.filter((t) => !t.distractor).every((t, i) => t.text === tokens[i]) && tokens.length > 1; tries++) mixed = shuffle(tiles, rng);
  return mixed;
}

const SLOT_ES: Record<string, string> = {
  S: 'Sujeto',
  V: 'Verbo',
  O: 'Objeto',
  DIR: 'Dirección',
  BE: 'Ser / estar',
  ADJ: 'Adjetivo',
  N: 'Sustantivo',
};
export const slotLabelEs = (slot: string): string => SLOT_ES[slot] ?? slot;

const PARTICLE_ROLE: Record<string, string> = {
  は: 'Tema / sujeto',
  が: 'Sujeto',
  も: 'Sujeto (también)',
  を: 'Objeto',
  に: 'Dirección / tiempo / lugar',
  へ: 'Dirección',
  で: 'Lugar de acción / medio',
  の: 'Posesión',
  と: 'Con / y',
  や: 'Y (ejemplos)',
  から: 'Desde',
  まで: 'Hasta',
  か: 'Pregunta',
};

export interface TableCell {
  label: string;
  /** Japanese text of the cell (tokens joined by a space). */
  text: string;
  /** True for the verb / predicate cell. */
  predicate: boolean;
}

/** Label of the predicate by the last slot of the pattern's Spanish structure. */
function predicateLabel(pattern: SentencePattern | undefined): string {
  const last = pattern?.english.at(-1)?.slot;
  if (last === 'V') return 'Verbo';
  if (last === 'ADJ') return 'Adjetivo + です';
  if (last === 'N' || last === 'BE') return 'Predicado (です)';
  return pattern?.english.some((s) => s.slot === 'V') ? 'Verbo' : 'Predicado';
}

export interface SolutionTable {
  /** Row 1: Spanish structure (S-V-O…). */
  spanish: { label: string; predicate: boolean }[];
  /** Row 2 and 3: Japanese structure (S-O-V…) and the sentence, cell by cell. */
  japanese: TableCell[];
}

/** The teacher's 3-row table: Spanish structure -> Japanese structure -> Japanese sentence. */
export function buildSolutionTable(pattern: SentencePattern | undefined, tokens: readonly string[]): SolutionTable {
  const p = parts(tokens);
  const cells: TableCell[] = [];
  const chunks: string[][] = [];
  for (const token of p.head) {
    if (isParticle(token) && chunks.length > 0) chunks[chunks.length - 1]!.push(token);
    else chunks.push([token]);
  }
  for (const chunk of chunks) {
    const particle = chunk.find(isParticle);
    cells.push({ label: particle ? (PARTICLE_ROLE[particle] ?? 'Complemento') : 'Complemento', text: chunk.join(' '), predicate: false });
  }
  if (p.tail.length > 0 || p.suffix.length > 0) {
    cells.push({ label: predicateLabel(pattern), text: [...p.tail, ...p.suffix].join(' '), predicate: true });
  }
  const spanish = (pattern?.english ?? []).map((s) => ({ label: slotLabelEs(s.slot), predicate: s.slot === 'V' || s.slot === 'BE' || s.slot === 'ADJ' }));
  return { spanish, japanese: cells };
}

export interface Entry {
  id: string;
  pattern: SentencePattern;
  example: PatternExample;
  tokens: string[];
}

/** Sentences of the given patterns that can be built with tiles (at least two pieces). */
export function syntaxEntries(patterns: readonly SentencePattern[]): Entry[] {
  return patterns.flatMap((pattern) =>
    examplesOf(pattern).flatMap((example, index) => {
      const tokens = tokenize(example.ja);
      return tokens.length >= 2 && example.es ? [{ id: `${pattern.id}:${index}`, pattern, example, tokens }] : [];
    }),
  );
}

