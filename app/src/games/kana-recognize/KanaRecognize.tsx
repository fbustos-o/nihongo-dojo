import { useState } from 'react';
import type { KanaEntry } from '../../domain/schema';
import { itemKey } from '../../state/progressSchema';
import { useProgress } from '../../state/progressStore';
import { judgeRomaji, kanaChoices } from '../kanaUtils';
import { ChoiceRound, Feedback, GameFrame, TypingRound, useGameSession, useQuestionPicker, type FeedbackMessage } from '../shared';
import styles from '../shared/games.module.css';
import type { GameProps } from '../types';

interface Question {
  entry: KanaEntry;
  mode: 'choice' | 'type';
  choices: KanaEntry[];
}

/** Kana -> romaji. Typed, except multiple choice for kana of the lesson that are still brand new. */
export function KanaRecognize({ kana, newKana, rounds, sequential, onFinish }: GameProps) {
  const session = useGameSession({ rounds, onFinish });
  const pool = kana.map((entry) => ({ id: entry.char, entry }));
  const pick = useQuestionPicker('kana', sequential);

  const make = (): Question => {
    const { entry } = pick(pool);
    const seen = useProgress.getState().items[itemKey('kana', entry.char)];
    const isNew = newKana?.includes(entry.char) && (seen?.correct ?? 0) < 1;
    const mode = isNew ? 'choice' : 'type';
    return { entry, mode, choices: mode === 'choice' ? kanaChoices(entry) : [] };
  };

  const [question, setQuestion] = useState<Question | null>(() => (pool.length ? make() : null));
  const [last, setLast] = useState<FeedbackMessage | null>(null);
  if (!question) return <p className="muted">No hay kana para practicar.</p>;

  const { entry } = question;
  const onReport = (ok: boolean) => {
    setLast(null);
    session.report(entry.char, 'kana', entry.char, ok);
  };
  const onDone = (firstTry: boolean) => {
    setLast(firstTry ? { tone: 'ok', text: `¡Correcto! ${entry.char} = ${entry.romaji}`, id: session.round } : null);
    session.next();
    setQuestion(make());
  };
  const big = <span lang="ja">{entry.char}</span>;

  return (
    <GameFrame session={session}>
      {last && <Feedback message={last} />}
      {question.mode === 'choice' ? (
        <ChoiceRound
          key={session.round}
          prompt={big}
          options={question.choices.map((k) => ({ key: k.char, content: k.romaji, correct: k.char === entry.char }))}
          onReport={onReport}
          onDone={onDone}
        />
      ) : (
        <TypingRound
          key={session.round}
          prompt={big}
          answer={entry.romaji}
          evaluate={(input) => judgeRomaji(input, entry)}
          inputMode="plain"
          ariaLabel="Romaji"
          placeholder="romaji"
          onReport={onReport}
          onDone={onDone}
        />
      )}
      <p className={`muted ${styles.hint}`}>Escribe el romaji y pulsa Enter.</p>
    </GameFrame>
  );
}
