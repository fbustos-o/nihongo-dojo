import { content } from '../domain/contentLoader';
import { computePathNodes, shortTitle, unmetRequirements } from './lessonLogic';

const { curriculum } = content;
const HIRA = curriculum.filter((l) => l.stage === 1).map((l) => l.id);
const upTo = (id: string) => HIRA.slice(0, HIRA.indexOf(id) + 1);
const status = (done: string[], id: string) => computePathNodes(curriculum, done).find((n) => n.lesson.id === id)!.status;
const GRAMMAR = curriculum.filter((l) => l.stage === 2);

/** Hiragana index of the last hiragana lesson a lesson needs (directly or through other lessons). */
function hiraGate(id: string, seen = new Map<string, number>()): number {
  if (seen.has(id)) return seen.get(id)!;
  const l = curriculum.find((x) => x.id === id)!;
  const g = Math.max(HIRA.indexOf(id), ...l.requires.map((r) => hiraGate(r, seen)));
  seen.set(id, g);
  return g;
}

describe('grammar is interleaved with hiragana', () => {
  it('l-saludos opens after あ..な only', () => {
    expect(curriculum.find((l) => l.id === 'l-saludos')!.requires).toEqual(['h-na']);
    expect(status(upTo('h-na'), 'l-saludos')).toBe('available');
    expect(status(upTo('h-ta'), 'l-saludos')).toBe('locked');
    expect(status(['h-a'], 'l-saludos')).toBe('locked');
  });

  it('no grammar lesson is gated before h-na', () => {
    const na = HIRA.indexOf('h-na');
    for (const l of GRAMMAR) expect(hiraGate(l.id), l.id).toBeGreaterThanOrEqual(na);
  });

  it('later grammar needs more hiragana, but not all of it', () => {
    expect(hiraGate('l-numeros')).toBeLessThanOrEqual(HIRA.indexOf('h-ma'));
    expect(hiraGate('l-verbos-1')).toBeLessThan(HIRA.indexOf('h-tsu-long'));
    expect(status([...upTo('h-na'), 'l-saludos'], 'l-hora')).toBe('locked');
    expect(status(HIRA, 'l-verbos-1')).toBe('locked'); // still needs the grammar before it
  });

  it('keeps the grammar order of stage 2 (ids unchanged)', () => {
    expect(GRAMMAR.slice(0, 4).map((l) => l.id)).toEqual(['l-saludos', 'l-numeros', 'l-desu', 'l-hora']);
    expect(curriculum.find((l) => l.id === 'l-desu')!.requires).toContain('l-saludos');
    expect(curriculum.find((l) => l.id === 'l-pasado')!.requires).toContain('l-conj-masu');
    expect(GRAMMAR.at(-1)!.id).toBe('l-te-imasu-tai');
  });

  it('a new grammar lesson becomes reachable at least every 3 hiragana lessons', () => {
    const gates = [...new Set(GRAMMAR.map((l) => hiraGate(l.id)))].sort((a, b) => a - b);
    expect(gates[0]).toBe(HIRA.indexOf('h-na'));
    for (let i = 1; i < gates.length; i++) expect(gates[i]! - gates[i - 1]!).toBeLessThanOrEqual(3);
    expect(gates.length).toBeGreaterThanOrEqual(4);
    expect(gates.at(-1)!).toBeLessThan(HIRA.length - 1);
  });

  it('katakana waits for ます verbs and for the end of hiragana', () => {
    expect(status(['l-verbos-1'], 'k-a')).toBe('locked');
    expect(status(HIRA, 'k-a')).toBe('locked');
    expect(status([...HIRA, 'l-verbos-1'], 'k-a')).toBe('available');
  });

  it('the unmet-requirements hint lists titles', () => {
    const l = curriculum.find((x) => x.id === 'l-saludos')!;
    const unmet = unmetRequirements(l, new Set(['h-a']), curriculum);
    expect(unmet.map((u) => u.id)).toEqual(['h-na']);
    expect(shortTitle(unmet[0]!)).toBe('Hiragana fila な');
    expect(unmetRequirements(l, new Set(['h-na']), curriculum)).toEqual([]);
  });
});
