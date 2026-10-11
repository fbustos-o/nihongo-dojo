import type { Dialogue, Lesson, Word } from '../../domain/schema';
import type { ItemKind } from '../../state/progressSchema';
import { shuffle } from '../kanaUtils';
import { scopedDialogues } from '../lessonScope';
import type { Rng } from '../numbers/random';

export const DIALOGUE_ITEM_KIND: ItemKind = 'dialogue';

export type Speaker = 'A' | 'B';
export type Line = Dialogue['lines'][number];

export interface ReplyOption {
  line: Line;
  correct: boolean;
}

/**
 * Dialogues to play. With `dialogueIds`, exactly those. Otherwise those of the lessons whose words are
 * all available in `words` (free practice); if none, every dialogue. For a lesson (`lessonId`) without dialogues
 * of its own: those of its ancestor lessons, otherwise nothing.
 */
export function eligibleDialogues(
  all: readonly Dialogue[],
  curriculum: readonly Pick<Lesson, 'words' | 'dialogues'>[],
  words: readonly Pick<Word, 'id'>[],
  dialogueIds?: readonly string[],
  lessonId?: string,
): Dialogue[] {
  if (dialogueIds && dialogueIds.length > 0) {
    const set = new Set(dialogueIds);
    const chosen = all.filter((d) => set.has(d.id));
    if (chosen.length > 0) return chosen;
  }
  // a lesson without dialogues of its own: only those of the lessons it builds on, otherwise none (QA-015)
  if (lessonId !== undefined) return scopedDialogues(all, lessonId, undefined, curriculum as readonly Lesson[]);
  const known = new Set(words.map((w) => w.id));
  const ok = new Set<string>();
  for (const lesson of curriculum) {
    const needed = lesson.words ?? [];
    if (needed.length > 0 && needed.every((id) => known.has(id))) (lesson.dialogues ?? []).forEach((id) => ok.add(id));
  }
  const chosen = all.filter((d) => ok.has(d.id));
  return chosen.length > 0 ? chosen : [...all];
}

/** Index of the first line at or after `from` spoken by `role` (lines.length if none). */
export function nextRoleLine(lines: readonly Line[], from: number, role: Speaker): number {
  for (let i = from; i < lines.length; i++) if (lines[i]!.speaker === role) return i;
  return lines.length;
}

export const hasRoleLine = (d: Dialogue, role: Speaker): boolean => d.lines.some((l) => l.speaker === role);

/** Partner lines directly followed by one of the learner's lines: [heard index] for the listening round. */
export function listenTargets(d: Dialogue, role: Speaker): number[] {
  const out: number[] = [];
  d.lines.forEach((line, i) => {
    if (line.speaker !== role && d.lines[i + 1]?.speaker === role) out.push(i);
  });
  return out;
}

const sameText = (a: Line, b: Line) => a.ja.replace(/\s+/g, '') === b.ja.replace(/\s+/g, '');

/**
 * The correct reply (`d.lines[index]`) plus distractors: one other line of the same speaker from the
 * same dialogue when there is one, the rest from other dialogues (same speaker preferred).
 */
export function replyOptions(
  d: Dialogue,
  index: number,
  everything: readonly Dialogue[],
  rng: Rng,
  count = 4,
  preferred: readonly Dialogue[] = everything,
): ReplyOption[] {
  const correct = d.lines[index]!;
  const taken: Line[] = [correct];
  const fresh = (l: Line) => !taken.some((t) => sameText(t, l));
  const sameDialogue = shuffle(d.lines.filter((l, i) => i !== index && l.speaker === correct.speaker && fresh(l)), rng);
  const others = (list: readonly Dialogue[]) => shuffle(list.filter((o) => o.id !== d.id).flatMap((o) => o.lines), rng);
  const pools = [
    sameDialogue.slice(0, 1),
    others(preferred).filter((l) => l.speaker === correct.speaker),
    others(everything).filter((l) => l.speaker === correct.speaker),
    others(everything),
    sameDialogue.slice(1),
  ];
  for (const pool of pools) {
    for (const l of pool) {
      if (taken.length >= count) break;
      if (fresh(l)) taken.push(l);
    }
  }
  return shuffle(
    taken.map((line) => ({ line, correct: line === correct })),
    rng,
  );
}

export const dialogueItemId = (d: Pick<Dialogue, 'id'>, line: number): string => `dialogue:${d.id}:${line}`;

/** Rounds for a dialogue session: the configured number, capped at 1.5 x the learner's turns available (QA-027). */
export function cappedRounds(rounds: number | undefined, dialogues: readonly Dialogue[], role: Speaker): number | undefined {
  if (rounds === undefined) return undefined;
  const turns = dialogues.reduce((n, d) => n + d.lines.filter((l) => l.speaker === role).length, 0);
  return Math.max(1, Math.min(rounds, Math.round(turns * 1.5)));
}
