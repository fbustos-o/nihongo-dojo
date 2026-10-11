import { useMemo, useState } from 'react';
import type { KanaEntry } from '../../domain/schema';
import { itemKey } from '../../state/progressSchema';
import { useProgress } from '../../state/progressStore';
import { confusableReview, hasConfusables, pickWithConfusableBoost } from '../confusables';
import { judgeRomaji, kanaHint, romajiLabel } from '../kanaUtils';
import { ChoiceRound, Feedback, GameFrame, TypingRound, useGameSession, useQuestionPicker, type FeedbackMessage } from '../shared';
import styles from '../shared/games.module.css';
import type { GameProps } from '../types';
import { buildRecognizeQuestion, type RecognizeQuestion } from './recognizeLogic';

/** Share of the picks that go to kana with a classic look-alike in katakana lessons. */
const CONFUSABLE_RATE = 0.5;

/**
 * Kana -> romaji. Typed, except multiple choice for kana of the lesson that are still brand new.
 * In katakana lessons: the look-alike pairs (シ/ツ, ソ/ン, ク/ケ/タ...) come up more often and serve as
 * distractors (including review of already known kana that resemble a new one), and some rounds ask
 * for the same sound in the other script (あ -> ア, ア -> あ).
 */
export function KanaRecognize({ kana, newKana, rounds, sequential, onFinish }: GameProps) {
  const session = useGameSession({ rounds, onFinish });
  const katakanaLesson = kana.length > 0 && kana.every((k) => k.script === 'katakana');
  const pool = useMemo(() => {
    const entries = kana.map((entry) => ({ id: entry.char, entry }));
    if (!katakanaLesson || sequential) return entries;
    // Known kana that look like a new one come back as review.
    const known = new Set(useProgress.getState().knownKana);
    const review = confusableReview(
      kana.map((k) => k.char),
      known,
    ).filter((k) => k.script === 'katakana');
    return [...entries, ...review.map((entry) => ({ id: entry.char, entry }))];
  }, [kana, katakanaLesson, sequential]);
  const pick = useQuestionPicker('kana', sequential);

  const make = (): RecognizeQuestion => {
    const { entry } =
      katakanaLesson && !sequential
        ? pickWithConfusableBoost(pool, pick, (item) => hasConfusables(item.entry.char), Math.random, CONFUSABLE_RATE)
        : pick(pool);
    const seen = useProgress.getState().items[itemKey('kana', entry.char)];
    const isNew = !!newKana?.includes(entry.char) && (seen?.correct ?? 0) < 1;
    const known = new Set([...useProgress.getState().knownKana, ...(newKana ?? []), ...kana.map((k) => k.char)]);
    return buildRecognizeQuestion(entry, { isNew, known, scriptPairs: katakanaLesson });
  };

  const [question, setQuestion] = useState<RecognizeQuestion | null>(() => (pool.length ? make() : null));
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
  const shown: KanaEntry = question.kind === 'script-pair' ? question.shown : entry;
  const big = <span lang="ja">{shown.char}</span>;
  const hint = kanaHint(entry);

  return (
    <GameFrame session={session}>
      <Feedback message={last} />
      {question.kind === 'choice' && (
        <ChoiceRound
          key={session.round}
          prompt={big}
          options={question.choices.map((k) => ({ key: k.char, content: romajiLabel(k), correct: k.char === entry.char }))}
          onReport={onReport}
          onDone={onDone}
        />
      )}
      {question.kind === 'script-pair' && (
        <ChoiceRound
          key={session.round}
          prompt={
            <>
              {big}
              <div className={styles.hint} data-testid="script-pair-hint">
                {shown.script === 'hiragana' ? 'Elige el mismo sonido en katakana' : 'Elige el mismo sonido en hiragana'}
              </div>
            </>
          }
          options={question.choices.map((k) => ({ key: k.char, content: <span lang="ja">{k.char}</span>, label: k.char, correct: k.char === question.answer.char }))}
          onReport={onReport}
          onDone={onDone}
        />
      )}
      {question.kind === 'type' && (
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
      {question.kind === 'type' ? (
        <p className={`muted ${styles.hint}`}>{hint ?? 'Escribe el romaji y pulsa Enter.'}</p>
      ) : (
        hint && <p className={`muted ${styles.hint}`}>{hint}</p>
      )}
    </GameFrame>
  );
}
