import type { Dialogue, GameId, Lesson, SentencePattern } from '../domain/schema';

type LessonRef = Pick<Lesson, 'id' | 'requires' | 'patterns' | 'dialogues'>;

/** Direct and indirect `requires` of a lesson (QA-015), in curriculum order. */
export function ancestorLessons<T extends Pick<Lesson, 'id' | 'requires'>>(lessonId: string, curriculum: readonly T[]): T[] {
  const byId = new Map(curriculum.map((l) => [l.id, l]));
  const seen = new Set<string>();
  const visit = (id: string) => {
    for (const dep of byId.get(id)?.requires ?? []) {
      if (seen.has(dep)) continue;
      seen.add(dep);
      visit(dep);
    }
  };
  visit(lessonId);
  return curriculum.filter((l) => seen.has(l.id));
}

/**
 * Patterns a game may use for a lesson. The lesson's own patterns when it has some; otherwise those of the
 * lessons it builds on (never the whole corpus, which includes grammar not taught yet); otherwise none.
 * Without a lesson (free practice / review) the given patterns, or the whole corpus, are used.
 */
export function scopedPatterns(
  own: readonly SentencePattern[] | undefined,
  lessonId: string | undefined,
  curriculum: readonly LessonRef[],
  corpus: readonly SentencePattern[],
): SentencePattern[] {
  if (own && own.length > 0) return [...own];
  if (lessonId === undefined) return [...corpus];
  const ids = new Set(ancestorLessons(lessonId, curriculum).flatMap((l) => l.patterns ?? []));
  return corpus.filter((p) => ids.has(p.id));
}

/** Dialogue ids of the lessons a lesson builds on (QA-015). */
export function ancestorDialogueIds(lessonId: string, curriculum: readonly LessonRef[]): string[] {
  return [...new Set(ancestorLessons(lessonId, curriculum).flatMap((l) => l.dialogues ?? []))];
}

/** Dialogues for a lesson: its own ids, else its ancestors', else none. */
export function scopedDialogues(all: readonly Dialogue[], lessonId: string, ownIds: readonly string[] | undefined, curriculum: readonly LessonRef[]): Dialogue[] {
  const ids = new Set(ownIds && ownIds.length > 0 ? ownIds : ancestorDialogueIds(lessonId, curriculum));
  return all.filter((d) => ids.has(d.id));
}

/**
 * Whether a lesson's game has material to play. Syntax / mini-reading need patterns and dialogues need
 * dialogues (own or inherited); the other games are not affected. The lesson runner skips games without material.
 */
export function gameHasMaterial(
  game: GameId,
  lesson: LessonRef,
  data: { curriculum: readonly LessonRef[]; patterns: readonly SentencePattern[]; dialogues: readonly Dialogue[] },
): boolean {
  if (game === 'syntax' || game === 'mini-reading') {
    const own = data.patterns.filter((p) => lesson.patterns?.includes(p.id));
    return scopedPatterns(own, lesson.id, data.curriculum, data.patterns).length > 0;
  }
  if (game === 'dialogues') return scopedDialogues(data.dialogues, lesson.id, lesson.dialogues, data.curriculum).length > 0;
  return true;
}
