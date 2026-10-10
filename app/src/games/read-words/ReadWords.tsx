import { useState } from 'react';
import { JaText } from '../../components/JaText';
import { checkAnswer } from '../../engine';
import type { Word } from '../../domain/schema';
import { useProgress } from '../../state/progressStore';
import { ChoiceRound, Feedback, GameFrame, TypingRound, useGameSession, useQuestionPicker, type FeedbackMessage } from '../shared';
import styles from '../shared/games.module.css';
import type { GameProps } from '../types';
import { meaningChoices, meaningOf } from '../wordUtils';

interface Question {
  word: Word;
  mode: 'meaning' | 'type';
  choices: { text: string; correct: boolean }[];
}

/**
 * Word (JaText: only unlocked kana appear as kana) -> Spanish meaning, or type its reading.
 * Alternates between the two. The romaji hint under the word follows `settings.showRomaji`
 * and is never shown when the romaji is the answer.
 */
export function ReadWords({ words, rounds, sequential, onFinish }: GameProps) {
  const session = useGameSession({ rounds, onFinish });
  const showRomaji = useProgress((s) => s.settings.showRomaji);
  const pool = words.map((word) => ({ id: word.id, word }));
  const pick = useQuestionPicker('word', sequential);

  const make = (round: number): Question => {
    const { word } = pick(pool);
    const mode = round % 2 === 0 ? 'meaning' : 'type';
    return { word, mode, choices: mode === 'meaning' ? meaningChoices(word) : [] };
  };

  const [question, setQuestion] = useState<Question | null>(() => (pool.length ? make(0) : null));
  const [last, setLast] = useState<FeedbackMessage | null>(null);
  if (!question) return <p className="muted">No hay palabras legibles todavía.</p>;

  const { word } = question;
  const onReport = (ok: boolean) => {
    setLast(null);
    session.report(word.id, 'word', word.kana, ok);
  };
  const onDone = (firstTry: boolean) => {
    setLast(firstTry ? { tone: 'ok', text: `¡Correcto! ${word.kana} = ${meaningOf(word)}`, id: session.round } : null);
    session.next();
    setQuestion(make(session.round + 1));
  };
  const shown = (
    <span className={styles.promptText} data-testid="word-prompt">
      <JaText word={word} />
    </span>
  );

  return (
    <GameFrame session={session}>
      {last && <Feedback message={last} />}
      {question.mode === 'meaning' ? (
        <ChoiceRound
          key={session.round}
          prompt={
            <>
              {shown}
              {showRomaji && <div className={styles.hint}>{word.romaji}</div>}
            </>
          }
          small
          options={question.choices.map((c) => ({ key: c.text, content: c.text, correct: c.correct }))}
          onReport={onReport}
          onDone={onDone}
        />
      ) : (
        <TypingRound
          key={session.round}
          prompt={
            <>
              {shown}
              <div className={styles.hint}>Escribe cómo se lee (romaji)</div>
            </>
          }
          answer={
            <>
              <JaText word={word} /> ({word.romaji})
            </>
          }
          evaluate={(input) => {
            const result = checkAnswer(input, word.kana);
            return result.correct ? 'correct' : result.nearMiss ? 'near' : 'wrong';
          }}
          inputMode="plain"
          ariaLabel="Lectura en romaji"
          placeholder="romaji"
          onReport={onReport}
          onDone={onDone}
        />
      )}
    </GameFrame>
  );
}
