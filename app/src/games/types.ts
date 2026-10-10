import type { Dialogue, KanaEntry, SentencePattern, Word } from '../domain/schema';

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
  /** Dialogues of the lesson. */
  dialogues?: Dialogue[];
  /** Dialogues of the lesson (ids from dialogues.json); the dialogues game plays these. Optional: without it the game infers them from `words`. */
  dialogueIds?: readonly string[];
  /** Called once with the session stats when the rounds are over (or the learner ends the session). */
  onFinish?: (stats: GameStats) => void;
}
