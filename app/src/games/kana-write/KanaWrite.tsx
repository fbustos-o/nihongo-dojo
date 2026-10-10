import { useState } from 'react';
import { SpeakButton } from '../../components/SpeakButton';
import { checkAnswer } from '../../engine';
import type { KanaEntry, Word } from '../../domain/schema';
import { Feedback, GameFrame, TypingHint, TypingRound, useGameSession, useQuestionPicker, type FeedbackMessage, type Verdict } from '../shared';
import styles from '../shared/games.module.css';
import type { GameProps } from '../types';

type Question =
  | { type: 'kana'; id: string; entry: KanaEntry }
  | { type: 'word'; id: string; word: Word };

const verdictOf = (input: string, expected: string, scriptSensitive: boolean): Verdict => {
  const result = checkAnswer(input, expected, { strict: true, scriptSensitive });
  return result.correct ? 'correct' : result.nearMiss ? 'near' : 'wrong';
};

/** Romaji (+ audio) -> type the kana with the IME. Every third round uses a lesson word when there are some. */
export function KanaWrite({ kana, words, rounds, sequential, onFinish }: GameProps) {
  const session = useGameSession({ rounds, onFinish });
  const kanaPool = kana.map((entry) => ({ id: entry.char, entry }));
  const wordPool = words.map((word) => ({ id: word.id, word }));
  const pickKana = useQuestionPicker('kana', sequential);
  const pickWord = useQuestionPicker('word', sequential);

  const make = (round: number): Question | null => {
    const useWord = wordPool.length > 0 && (kanaPool.length === 0 || round % 3 === 2);
    if (useWord) {
      const { word } = pickWord(wordPool);
      return { type: 'word', id: word.id, word };
    }
    if (kanaPool.length === 0) return null;
    const { entry } = pickKana(kanaPool);
    return { type: 'kana', id: entry.char, entry };
  };

  const [question, setQuestion] = useState<Question | null>(() => make(0));
  const [last, setLast] = useState<FeedbackMessage | null>(null);
  if (!question) return <p className="muted">No hay contenido para practicar.</p>;

  const isWord = question.type === 'word';
  const expected = isWord ? question.word.kana : question.entry.char;
  // Katakana-only words (loanwords) are typed with the katakana IME, where `-` and a repeated vowel give ー.
  const katakana = isWord ? /^[ァ-ヺー]+$/.test(question.word.kana) : question.entry.script === 'katakana';
  const romaji = isWord ? question.word.romaji : question.entry.romaji;

  const onReport = (ok: boolean) => {
    setLast(null);
    session.report(question.id, isWord ? 'word' : 'kana', expected, ok);
  };
  const onDone = (firstTry: boolean) => {
    setLast(firstTry ? { tone: 'ok', text: `¡Correcto! ${expected}`, id: session.round } : null);
    session.next();
    setQuestion(make(session.round + 1));
  };

  return (
    <GameFrame session={session}>
      {last && <Feedback message={last} />}
      <TypingRound
        key={session.round}
        prompt={
          <>
            <span className={styles.promptText} data-testid="romaji">{romaji}</span>
            {isWord && <div className={styles.hint}>{question.word.es.join(', ')}</div>}
            <TypingHint text={expected} />
            {katakana && expected.includes('ー') && <div className={styles.hint}>ー se escribe con «-» (o repitiendo la vocal).</div>}
            <div>
              <SpeakButton text={expected} />
            </div>
          </>
        }
        answer={expected}
        evaluate={(input) => verdictOf(input, expected, katakana)}
        inputMode={katakana ? 'katakana' : 'hiragana'}
        ariaLabel="Escribe en kana"
        placeholder="escribe en romaji → kana"
        onReport={onReport}
        onDone={onDone}
      />
    </GameFrame>
  );
}
