import { content } from '../domain/contentLoader';
import type { GameId, KanaEntry, Kanji, Lesson, Word } from '../domain/schema';
import { filterReadable, isReadableWith, unlockedKanaForLessons } from '../engine';
import { isImplemented } from '../games/registry';
import { emptyStats, type GameStats } from '../games/types';
import { useProgress } from '../state/progressStore';

/** A lesson is completed when overall accuracy reaches this. */
export const PASS_ACCURACY = 0.8;
export const XP_PER_CORRECT = 10;

export type LessonStatus = 'locked' | 'available' | 'completed';

export interface LessonNode {
  lesson: Lesson;
  status: LessonStatus;
  /** At least one of its games exists. Locked lessons keep this too. */
  playable: boolean;
  /** Available but none of its games is built yet ("próximamente"). */
  comingSoon: boolean;
}

export const STAGE_TITLES: Record<Lesson['stage'], string> = {
  1: 'Hiragana',
  2: 'Gramática en hiragana',
  3: 'Katakana',
  4: 'Kanji',
};

export function lessonStatus(lesson: Lesson, completed: ReadonlySet<string>): LessonStatus {
  if (completed.has(lesson.id)) return 'completed';
  return lesson.requires.every((id) => completed.has(id)) ? 'available' : 'locked';
}

/** Games of a lesson that can be played now. */
export const playableGames = (lesson: Lesson, implemented: (id: GameId) => boolean = isImplemented): GameId[] =>
  lesson.games.filter(implemented);

export function computePathNodes(
  curriculum: readonly Lesson[],
  completedIds: Iterable<string>,
  implemented: (id: GameId) => boolean = isImplemented,
): LessonNode[] {
  const completed = new Set(completedIds);
  return curriculum.map((lesson) => {
    const status = lessonStatus(lesson, completed);
    const playable = playableGames(lesson, implemented).length > 0;
    return { lesson, status, playable, comingSoon: status !== 'locked' && !playable };
  });
}

export interface StageProgress {
  stage: Lesson['stage'];
  total: number;
  done: number;
}

export function stageProgress(curriculum: readonly Lesson[], completedIds: Iterable<string>): StageProgress[] {
  const completed = new Set(completedIds);
  return ([1, 2, 3, 4] as const).map((stage) => {
    const lessons = curriculum.filter((l) => l.stage === stage);
    return { stage, total: lessons.length, done: lessons.filter((l) => completed.has(l.id)).length };
  });
}

/** First available, playable, not completed lesson in curriculum order. */
export const nextLesson = (nodes: readonly LessonNode[]): Lesson | undefined =>
  nodes.find((n) => n.status === 'available' && n.playable)?.lesson;

/** Rounds per game: 10-15, growing with the number of items. */
export const roundsFor = (itemCount: number): number => Math.max(10, Math.min(15, 8 + itemCount));

/** Rounds of the kanji game: two per kanji, between 12 and 24. */
export const kanjiRounds = (kanjiCount: number): number => Math.max(12, Math.min(24, kanjiCount * 2));

export const accuracyOf = (stats: Pick<GameStats, 'total' | 'correct'>): number => (stats.total === 0 ? 0 : stats.correct / stats.total);
export const isPassed = (stats: Pick<GameStats, 'total' | 'correct'>): boolean => stats.total > 0 && accuracyOf(stats) >= PASS_ACCURACY;

/** Adds up the stats of several games. */
export function mergeStats(list: readonly GameStats[]): GameStats {
  const out = emptyStats();
  for (const s of list) {
    out.total += s.total;
    out.correct += s.correct;
    out.bestStreak = Math.max(out.bestStreak, s.bestStreak);
    for (const [key, tally] of Object.entries(s.items)) {
      const cur = out.items[key] ?? { label: tally.label, correct: 0, wrong: 0 };
      out.items[key] = { label: cur.label, correct: cur.correct + tally.correct, wrong: cur.wrong + tally.wrong };
    }
  }
  return out;
}

/** Items answered wrong at least once, worst first. */
export function weakestItems(stats: GameStats, limit = 5): { key: string; label: string; wrong: number; correct: number }[] {
  return Object.entries(stats.items)
    .map(([key, t]) => ({ key, ...t }))
    .filter((t) => t.wrong > 0)
    .sort((a, b) => b.wrong / (b.wrong + b.correct) - a.wrong / (a.wrong + a.correct) || b.wrong - a.wrong)
    .slice(0, limit);
}

export const xpEarned = (stats: Pick<GameStats, 'correct'>): number => stats.correct * XP_PER_CORRECT;

/**
 * Applies the end of a lesson: when accuracy passes, the lesson is marked completed, its kana are
 * added to `progress.knownKana` (JaText and the kana filter read that set) and its kanji to
 * `progress.unlockedKanji` at SRS stage 1.
 */
export function finishLesson(lesson: Lesson, stats: GameStats): { passed: boolean; accuracy: number } {
  const passed = isPassed(stats);
  if (passed) {
    const store = useProgress.getState();
    store.unlockKana(lesson.kana ?? []);
    // kanji enter the store's kanji map at SRS stage 1; JaText then shows them with furigana everywhere
    store.unlockKanji(lesson.kanji ?? []);
    store.completeLesson(lesson.id);
  }
  return { passed, accuracy: accuracyOf(stats) };
}

/** Makes sure every completed lesson's kana are in knownKana (e.g. after importing progress). */
export function syncKnownKana(curriculum: readonly Lesson[] = content.curriculum): void {
  const { completedLessons, knownKana, unlockKana } = useProgress.getState();
  const unlocked = unlockedKanaForLessons(curriculum, completedLessons);
  if ([...unlocked].some((k) => !knownKana.includes(k))) unlockKana(unlocked);
}

/** Every kanji of the completed lessons. */
export function unlockedKanjiForLessons(curriculum: readonly Lesson[], completedIds: Iterable<string>): Set<string> {
  const completed = new Set(completedIds);
  return new Set(curriculum.filter((l) => completed.has(l.id)).flatMap((l) => l.kanji ?? []));
}

/** Makes sure every completed lesson's kanji are unlocked (e.g. after importing progress). Existing SRS progress is kept. */
export function syncKnownKanji(curriculum: readonly Lesson[] = content.curriculum): void {
  const { completedLessons, unlockedKanji, unlockKanji } = useProgress.getState();
  const unlocked = unlockedKanjiForLessons(curriculum, completedLessons);
  if ([...unlocked].some((k) => !unlockedKanji.includes(k))) unlockKanji(unlocked);
}

export interface LessonContent {
  kana: KanaEntry[];
  words: Word[];
  newKana: string[];
  /** Kanji introduced by the lesson (kanji lessons). */
  kanji: Kanji[];
  newKanji: string[];
}

/** Direct and indirect `requires` of a lesson, in curriculum order. */
function ancestors(lesson: Lesson, curriculum: readonly Lesson[]): Lesson[] {
  const byId = new Map(curriculum.map((l) => [l.id, l]));
  const seen = new Set<string>();
  const visit = (l: Lesson) => l.requires.forEach((id) => {
    if (seen.has(id)) return;
    seen.add(id);
    const dep = byId.get(id);
    if (dep) visit(dep);
  });
  visit(lesson);
  return curriculum.filter((l) => seen.has(l.id));
}

const IS_KANJI = /[一-鿿]/u;

/** Words written with kanji whose kanji are all among `allowed` (those of this kanji lesson and the previous ones). */
export function kanjiLessonWords(words: readonly Word[], allowed: Iterable<string>): Word[] {
  const ok = new Set(allowed);
  return words.filter((w) => w.kanji !== undefined && [...w.kanji].every((ch) => !IS_KANJI.test(ch) || ok.has(ch)));
}

const HAS_KATAKANA = /[ァ-ヺ]/;

/**
 * Stage 3 words: loanwords readable with the known katakana plus the lesson's, and hiragana known from
 * stage 1. Mixed-script words (テニスをする) are fine; purely hiragana words from stage 2 are left out,
 * since the lesson practises katakana.
 */
export function stage3Words(words: readonly Word[], known: ReadonlySet<string>): Word[] {
  return words.filter((w) => HAS_KATAKANA.test(w.kana) && isReadableWith(w.kana, known));
}

/**
 * What the games of a lesson practise: the lesson's kana, and its words plus those of the lessons
 * it builds on. Stage 1 words are limited to what is readable with the known kana plus the
 * lesson's new kana; stage 3 likewise (see `stage3Words`). The other stages rely on JaText to hide what is still locked.
 */
export function lessonContent(
  lesson: Lesson,
  knownKana: ReadonlySet<string>,
  data: { kana: readonly KanaEntry[]; vocab: readonly Word[]; curriculum: readonly Lesson[]; kanji?: readonly Kanji[] } = content,
): LessonContent {
  const newKana = lesson.kana ?? [];
  const kana = data.kana.filter((k) => newKana.includes(k.char));
  const known = new Set([...knownKana, ...newKana]);
  const byId = new Map(data.vocab.map((w) => [w.id, w]));
  const ids = [...ancestors(lesson, data.curriculum), lesson].flatMap((l) => l.words ?? []);
  const own = new Set(lesson.words ?? []);
  // Own words first, then those of the lessons it builds on.
  const ordered = [...(lesson.words ?? []), ...ids.filter((id) => !own.has(id))];
  const unique = [...new Set(ordered)].map((id) => byId.get(id)).filter((w): w is Word => w !== undefined);
  const newKanji = lesson.kanji ?? [];
  const kanji = newKanji.flatMap((c) => data.kanji?.find((k) => k.char === c) ?? []);
  const words =
    lesson.stage === 1
      ? filterReadable(unique, known)
      : lesson.stage === 3
        ? stage3Words(unique, known)
        : lesson.stage === 4
          ? kanjiLessonWords(unique, [...ancestors(lesson, data.curriculum), lesson].flatMap((l) => l.kanji ?? []))
          : unique;
  return { kana, words, newKana: [...newKana], kanji, newKanji: [...newKanji] };
}
