import type { KanaEntry, Kanji, SentencePattern, Word } from '../domain/schema';

/** Per-item tally of one game session. */
export interface ItemTally {
  label: string;
  correct: number;
  wrong: number;
}

export interface GameStats {
  /** Rounds answered (each round counts once, judged on the first attempt). */
  total: number;
  correct: number;
  bestStreak: number;
  items: Record<string, ItemTally>;
}

export const emptyStats = (): GameStats => ({ total: 0, correct: 0, bestStreak: 0, items: {} });

/** Props every game component receives (see games/README.md). */
export interface GameProps {
  /** Kana to practise (kana games). */
  kana: KanaEntry[];
  /** Kanji to practise (kanji game: the lesson's new kanji, the due ones in a review, or the chosen lesson range). */
  kanji?: Kanji[];
  /** Kanji introduced by the current lesson (shown with furigana through ExtraKanjiContext). */
  newKanji?: readonly string[];
  /** Words the learner can read with what is unlocked (word games). */
  words: Word[];
  /** Kana introduced by the current lesson; kana-recognize uses multiple choice while they are brand new. */
  newKana?: readonly string[];
  /** Number of rounds. Undefined = endless (free practice); the session ends with the "Terminar" button. */
  rounds?: number;
  /** Go through `kana`/`words` in order instead of using the weighted picker (review queue). */
  sequential?: boolean;
  /** Id of the lesson being played (conjugation maps it to the allowed forms). Undefined = free practice. */
  lessonId?: string;
  /** Sentence patterns of the lesson (syntax, particles, mini-reading). */
  patterns?: SentencePattern[];
  /** Dialogues to play (ids from dialogues.json): the lesson's, or the due ones in a review. Without it the dialogues game infers them from `words`. */
  dialogueIds?: readonly string[];
  /**
   * Review sessions: restrict the question pool to these progress item ids (the ids the game records,
   * e.g. `svo-masu:2` in syntax, `particle:wa:0` in particles, `verb:taberu:te` in conjugation).
   * Ignored by games whose questions are generated at random (numbers, clock, calendar).
   */
  onlyItems?: readonly string[];
  /** Called once with the session stats when the rounds are over (or the learner ends the session). */
  onFinish?: (stats: GameStats) => void;
}
