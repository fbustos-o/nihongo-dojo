import { useMemo, useState, type ReactNode } from 'react';
import { JaText } from '../../components/JaText';
import { SpeakButton } from '../../components/SpeakButton';
import { Feedback, GameFrame, TypingRound, useGameSession, useQuestionPicker, type FeedbackMessage } from '../shared';
import styles from './numbers.module.css';
import type { GameProps } from '../types';
import { KanaWithRomaji, ModeChips, ReadingRound, useAutoSpeak } from './ReadingRound';
import { MODE_LABELS, NUMBER_ITEM_KIND, formatYen, makeNumberQuestion, modePool, availableModes, parseTypedNumber, tierForRound, type NumberMode, type NumberQuestion } from './numbersLogic';
import { pickOne, uniqueById, type Rng } from './random';

type ModeChoice = 'mix' | NumberMode;

/** Builds the next question: picks from a few candidates with the weighted picker. */
export function buildNumberQuestion(
  pool: readonly NumberMode[],
  tier: number,
  rng: Rng,
  pick: (c: NumberQuestion[]) => NumberQuestion,
): NumberQuestion {
  const candidates = uniqueById(Array.from({ length: 6 }, () => makeNumberQuestion(pickOne(rng, pool), tier, rng)));
  return pick(candidates);
}

interface ViewProps {
  question: NumberQuestion;
  rng?: Rng;
  onReport: (correct: boolean) => void;
  onDone: (firstTry: boolean) => void;
}

function ObjectLine({ question }: { question: NumberQuestion }) {
  const object = question.object!;
  return (
    <p className={styles.question}>
      <span className={styles.emoji} aria-hidden="true">{object.emoji}</span>
      <br />
      <JaText word={{ kana: object.kana }} /> · {object.es}
    </p>
  );
}

/** One question of the numbers game (typed / choice / hear-and-type). */
export function NumberQuestionView({ question, rng, onReport, onDone }: ViewProps) {
  const spoken = question.reading.kana;
  const hears = question.mode === 'hear' || question.mode === 'priceHear';
  const audio = useAutoSpeak(hears ? spoken : '', question.itemId);

  if (hears) {
    const prompt: ReactNode = (
      <>
        {question.object && <ObjectLine question={question} />}
        {question.mode === 'priceHear' && <p lang="ja" className={styles.question}>いくらですか？</p>}
        <p className={styles.question}>Escucha y escribe el {question.mode === 'priceHear' ? 'precio' : 'número'} con cifras.</p>
        <SpeakButton text={spoken} label="Escuchar otra vez" />
        <p className={styles.kanaLine}><KanaWithRomaji reading={question.reading} /></p>
        {!audio && <small className="muted">Sin voz en japonés: lee el kana.</small>}
      </>
    );
    return (
      <TypingRound
        prompt={prompt}
        answer={<span>{question.mode === 'priceHear' ? formatYen(question.value) : question.value}</span>}
        inputMode="plain"
        ariaLabel="Número con cifras"
        placeholder="Escribe las cifras"
        evaluate={(input) => (parseTypedNumber(input) === question.value ? 'correct' : 'wrong')}
        onReport={onReport}
        onDone={onDone}
      />
    );
  }

  let prompt: ReactNode;
  if (question.mode === 'digits') {
    prompt = (
      <>
        <p className={styles.question}>¿Cómo se lee?</p>
        <p className={styles.big}>{question.value}</p>
      </>
    );
  } else if (question.mode === 'price') {
    prompt = (
      <>
        <ObjectLine question={question} />
        <p lang="ja" className={styles.question}>いくらですか？</p>
        <p className={styles.big}>{formatYen(question.value)}</p>
        <p className={styles.question}>Escribe el precio en hiragana (con えん).</p>
      </>
    );
  } else {
    const { spec, n } = question.counter!;
    prompt = (
      <>
        <p className={styles.question}>¿Cómo se dice?</p>
        <p className={styles.big}>{spec.display(n)}</p>
      </>
    );
  }
  return (
    <ReadingRound
      prompt={prompt}
      reading={question.reading}
      format={question.format === 'choice' ? 'choice' : 'type'}
      related={question.related}
      rng={rng}
      onReport={onReport}
      onDone={onDone}
    />
  );
}

/** "Números y precios": numbers, prices, counters (see games/README.md). */
export function Numbers({ words, rounds, sequential, onFinish }: GameProps) {
  const session = useGameSession({ rounds, onFinish });
  const pick = useQuestionPicker(NUMBER_ITEM_KIND, sequential);
  const [mode, setMode] = useState<ModeChoice>('mix');
  const modes = useMemo(() => availableModes(words), [words]);
  const mixPool = useMemo(() => modePool(words), [words]);

  const make = (round: number, choice: ModeChoice) =>
    buildNumberQuestion(choice === 'mix' ? mixPool : [choice], tierForRound(round, rounds), Math.random, (c) => pick(c));

  const [question, setQuestion] = useState<NumberQuestion>(() => make(0, 'mix'));
  const [last, setLast] = useState<FeedbackMessage | null>(null);

  const changeMode = (next: ModeChoice) => {
    setMode(next);
    setQuestion(make(session.round, next));
  };

  return (
    <GameFrame session={session}>
      {rounds === undefined && (
        <ModeChips
          label="Modo"
          value={mode}
          onChange={changeMode}
          options={[{ value: 'mix', label: 'Mezcla' }, ...modes.map((m) => ({ value: m, label: MODE_LABELS[m] }))]}
        />
      )}
      {last && <Feedback message={last} />}
      <NumberQuestionView
        key={`${session.round}-${question.itemId}`}
        question={question}
        onReport={(ok) => {
          setLast(null);
          session.report(question.itemId, NUMBER_ITEM_KIND, question.label, ok);
        }}
        onDone={(firstTry) => {
          setLast(firstTry ? { tone: 'ok', text: `¡Correcto! ${question.label}`, id: session.round } : null);
          session.next();
          setQuestion(make(session.round + 1, mode));
        }}
      />
    </GameFrame>
  );
}
