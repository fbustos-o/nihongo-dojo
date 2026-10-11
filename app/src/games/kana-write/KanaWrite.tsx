import { useEffect, useState } from 'react';
import { SpeakButton } from '../../components/SpeakButton';
import { checkAnswer } from '../../engine';
import type { KanaEntry, Word } from '../../domain/schema';
import { useCanHear, useSpeech } from '../../hooks/useSpeech';
import { itemKey } from '../../state/progressSchema';
import { useProgress } from '../../state/progressStore';
import { Feedback, GameFrame, TypingHint, TypingRound, useGameSession, useQuestionPicker, type FeedbackMessage, type Verdict } from '../shared';
import styles from '../shared/games.module.css';
import type { GameProps } from '../types';
import { writePrompt } from '../kanaUtils';

/** Lectura: the romaji is shown (audio only after answering). Dictado: audio only, no text before answering. */
export type WriteMode = 'lectura' | 'dictado';
/** Free practice: the learner picks Lectura, Dictado, or leaves "Mixto" (new kana read, already-seen kana dictated). */
export type WriteChoice = 'mixto' | WriteMode;

type Question =
  | { type: 'kana'; id: string; entry: KanaEntry; wanted: WriteMode }
  | { type: 'word'; id: string; word: Word; wanted: WriteMode };

const verdictOf = (input: string, expected: string, scriptSensitive: boolean): Verdict => {
  const result = checkAnswer(input, expected, { strict: true, scriptSensitive });
  return result.correct ? 'correct' : result.nearMiss ? 'near' : 'wrong';
};

const CHOICE_LABELS: Record<WriteChoice, string> = { mixto: 'Mixto', lectura: 'Lectura', dictado: 'Dictado' };

/**
 * Which mode a question gets: an explicit choice wins; "mixto" (and every lesson) reads items the learner has
 * not answered correctly yet and dictates the ones already seen. Kana whose romaji is ambiguous (を, ぢ, づ) are
 * never dictated, since the sound does not tell them from お / じ / ず.
 */
export function modeFor(choice: WriteChoice, seen: boolean, ambiguous: boolean): WriteMode {
  if (choice !== 'mixto') return choice === 'dictado' && ambiguous ? 'lectura' : choice;
  return seen && !ambiguous ? 'dictado' : 'lectura';
}

/** Type the kana for a romaji (Lectura) or for what you hear (Dictado). Every third round uses a lesson word when there are some. */
export function KanaWrite({ kana, words, rounds, sequential, onFinish }: GameProps) {
  const session = useGameSession({ rounds, onFinish });
  const { speak } = useSpeech();
  // Items answered right in this game's own session: Dictado is for those (every other round in a lesson); new ones are read first (QA-043).
  const [answeredHere] = useState(() => new Set<string>());
  const kanaPool = kana.map((entry) => ({ id: entry.char, entry }));
  const wordPool = words.map((word) => ({ id: word.id, word }));
  const pickKana = useQuestionPicker('kana', sequential);
  const pickWord = useQuestionPicker('word', sequential);
  const free = rounds === undefined;
  const [choice, setChoice] = useState<WriteChoice>('mixto');

  const make = (round: number, pref: WriteChoice = choice): Question | null => {
    const items = useProgress.getState().items;
    const useWord = wordPool.length > 0 && (kanaPool.length === 0 || round % 3 === 2);
    if (useWord) {
      const { word } = pickWord(wordPool);
      const seen = (answeredHere.has(word.id) && (free || round % 2 === 1)) || (free && (items[itemKey('word', word.id)]?.correct ?? 0) > 0);
      return { type: 'word', id: word.id, word, wanted: modeFor(pref, seen, false) };
    }
    if (kanaPool.length === 0) return null;
    const { entry } = pickKana(kanaPool);
    const seen = (answeredHere.has(entry.char) && (free || round % 2 === 1)) || (free && (items[itemKey('kana', entry.char)]?.correct ?? 0) > 0);
    return { type: 'kana', id: entry.char, entry, wanted: modeFor(pref, seen, writePrompt(entry).note !== undefined) };
  };

  const [question, setQuestion] = useState<Question | null>(() => make(0));
  const [last, setLast] = useState<FeedbackMessage | null>(null);

  const isWord = question?.type === 'word';
  const expected = !question ? '' : question.type === 'word' ? question.word.kana : question.entry.char;
  // Without a Japanese voice, Dictado degrades to Lectura (and says so).
  const available = useCanHear(expected);
  const mode: WriteMode = question?.wanted === 'dictado' && available ? 'dictado' : 'lectura';
  const degraded = !available && (choice === 'dictado' || (choice === 'mixto' && question?.wanted === 'dictado'));

  useEffect(() => {
    if (mode === 'dictado' && expected) void speak(expected);
  }, [mode, expected, speak, session.round]);

  if (!question) return <p className="muted">No hay contenido para practicar.</p>;

  // Katakana-only words (loanwords) are typed with the katakana IME, where `-` and a repeated vowel give ー.
  const katakana = isWord ? /^[ァ-ヺー]+$/.test(question.word.kana) : question.entry.script === 'katakana';
  const prompt = isWord ? { romaji: question.word.romaji } : writePrompt(question.entry);

  const onReport = (ok: boolean) => {
    setLast(null);
    if (ok) answeredHere.add(question.id);
    session.report(question.id, isWord ? 'word' : 'kana', expected, ok);
  };
  const onDone = (firstTry: boolean) => {
    // Lectura: the sound comes now, after answering.
    if (mode === 'lectura' && available) void speak(expected);
    setLast(
      firstTry
        ? {
            tone: 'ok',
            text: `¡Correcto! ${expected}`,
            node: (
              <>
                ¡Correcto! <span lang="ja">{expected}</span> <SpeakButton text={expected} />
              </>
            ),
            id: session.round,
          }
        : null,
    );
    session.next();
    setQuestion(make(session.round + 1));
  };

  return (
    <GameFrame session={session}>
      {free && (
        <div className={styles.chips} role="group" aria-label="Modo de escritura">
          {(Object.keys(CHOICE_LABELS) as WriteChoice[]).map((c) => (
            <button
              key={c}
              type="button"
              className={`${styles.chip} ${choice === c ? styles.chipOn : ''}`}
              aria-pressed={choice === c}
              onClick={() => {
                setChoice(c);
                setQuestion(make(session.round, c));
              }}
            >
              {CHOICE_LABELS[c]}
            </button>
          ))}
        </div>
      )}
      {degraded && (
        <p className={styles.notice} role="note" data-testid="dictado-fallback">
          Tu navegador no tiene una voz en japonés: el dictado se sustituye por lectura (se muestra el romaji).
        </p>
      )}
      <Feedback message={last} />
      <TypingRound
        key={session.round}
        prompt={
          mode === 'lectura' ? (
            <>
              <span className={styles.promptText} data-testid="romaji">{prompt.romaji}</span>
              {prompt.note && <div className={styles.hint} data-testid="write-note">{prompt.note}</div>}
              {isWord && <div className={styles.hint}>{question.word.es.join(', ')}</div>}
              <TypingHint text={expected} />
              {katakana && expected.includes('ー') && <div className={styles.hint}>ー se escribe con «-» (o repitiendo la vocal).</div>}
              <div className={styles.hint} data-testid="write-mode">Lectura</div>
            </>
          ) : (
            <>
              <SpeakButton text={expected} label="Escuchar otra vez" />
              <div className={styles.hint} data-testid="write-mode">
                Dictado · escribe en {katakana ? 'katakana' : 'hiragana'} lo que oyes
              </div>
            </>
          )
        }
        answer={
          <>
            {expected} <SpeakButton text={expected} />
          </>
        }
        evaluate={(input) => verdictOf(input, expected, katakana)}
        inputMode={katakana ? 'katakana' : 'hiragana'}
        ariaLabel="Escribe en kana"
        placeholder={mode === 'dictado' ? 'escribe lo que oyes' : 'escribe en kana'}
        onReport={onReport}
        onDone={onDone}
      />
    </GameFrame>
  );
}
