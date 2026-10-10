import { useMemo, useRef, useState } from 'react';
import { SpeakButton } from '../../components/SpeakButton';
import { Feedback, GameFrame, useGameSession, useQuestionPicker, type FeedbackMessage } from '../shared';
import { playSfx } from '../shared/sfx';
import { KanaWithRomaji, ModeChips, ReadingRound, useAutoSpeak } from '../numbers/ReadingRound';
import { pickOne, uniqueById, type Rng } from '../numbers/random';
import numberStyles from '../numbers/numbers.module.css';
import type { GameProps } from '../types';
import { AnalogClock } from './AnalogClock';
import styles from './clock.module.css';
import { CLOCK_ITEM_KIND, clockTierForRound, makeClockQuestion, pad2, sameTime, stepHour, stepMinute, timeText, type ClockQuestion } from './clockLogic';

type ModeChoice = 'mix' | 'read' | 'set';

const spanishTime = (t: { h: number; m: number }) => `las ${timeText(t)}`;

interface ViewProps {
  question: ClockQuestion;
  rng?: Rng;
  onReport: (correct: boolean) => void;
  onDone: (firstTry: boolean) => void;
}

/** Clock face → type or pick the reading. The time is only in the text alternative after a miss. */
export function ClockReadView({ question, rng, onReport, onDone }: ViewProps) {
  const [missed, setMissed] = useState(false);
  const { time } = question;
  const prompt = (
    <>
      <AnalogClock
        h={time.h}
        m={time.m}
        label={missed ? `Reloj analógico que marca ${spanishTime(time)}` : 'Reloj analógico con una hora dibujada con las manecillas; la respuesta se revela después de contestar'}
      />
      <p lang="ja" className={styles.kana}>いま なんじですか？</p>
      <p className={numberStyles.question}>¿Qué hora marca el reloj?</p>
    </>
  );
  return (
    <ReadingRound
      prompt={prompt}
      reading={question.reading}
      format={question.format}
      related={question.related}
      rng={rng}
      ariaLabel="Hora en hiragana"
      onReport={(ok) => {
        if (!ok) setMissed(true);
        onReport(ok);
      }}
      onDone={onDone}
    />
  );
}

/** Reading → set the clock with the − / + buttons. */
export function ClockSetView({ question, onReport, onDone }: ViewProps) {
  const [h, setH] = useState(12);
  const [m, setM] = useState(0);
  const [wrongs, setWrongs] = useState(0);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const counter = useRef(0);
  useAutoSpeak(question.reading.kana, question.itemId);

  const check = () => {
    if (sameTime({ h, m }, question.time)) {
      if (wrongs === 0) {
        onReport(true);
        playSfx('ok');
      }
      onDone(wrongs === 0);
      return;
    }
    if (wrongs === 0) onReport(false);
    playSfx('bad');
    setWrongs((w) => w + 1);
    setMessage({ tone: 'bad', text: 'Todavía no. Ajusta las manecillas y vuelve a comprobar.', id: ++counter.current });
  };

  const buttons: { label: string; apply: () => void }[] = [
    { label: 'Hora −', apply: () => setH((v) => stepHour(v, -1)) },
    { label: 'Hora +', apply: () => setH((v) => stepHour(v, 1)) },
    { label: '5 min −', apply: () => setM((v) => stepMinute(v, -5)) },
    { label: '5 min +', apply: () => setM((v) => stepMinute(v, 5)) },
    { label: '1 min −', apply: () => setM((v) => stepMinute(v, -1)) },
    { label: '1 min +', apply: () => setM((v) => stepMinute(v, 1)) },
  ];

  return (
    <div className={numberStyles.question}>
      <div data-testid="prompt">
        <p className={numberStyles.question}>Pon el reloj a esta hora:</p>
        <p className={styles.kana}><KanaWithRomaji reading={question.reading} /></p>
        <SpeakButton text={question.reading.kana} label="Escuchar otra vez" />
      </div>
      <AnalogClock h={h} m={m} label={`Reloj ajustado: ${spanishTime({ h, m })}`} />
      <p className={styles.caption} role="status" aria-live="polite">
        Marcas: <strong data-testid="set-time">{h}:{pad2(m)}</strong>
      </p>
      <Feedback message={message} />
      <div className={styles.controls} role="group" aria-label="Ajustar el reloj">
        {buttons.map((b) => (
          <button key={b.label} type="button" className="btn" onClick={b.apply}>
            {b.label}
          </button>
        ))}
      </div>
      <p>
        <button type="button" className="btn btn-primary" onClick={check}>
          Comprobar
        </button>
      </p>
    </div>
  );
}

export function Clock({ rounds, sequential, onFinish }: GameProps) {
  const session = useGameSession({ rounds, onFinish });
  const pick = useQuestionPicker(CLOCK_ITEM_KIND, sequential);
  const [mode, setMode] = useState<ModeChoice>('mix');
  const kinds = useMemo(() => ['read', 'read', 'set'] as const, []);

  const make = (round: number, choice: ModeChoice): ClockQuestion => {
    const tier = clockTierForRound(round, rounds);
    const kind = choice === 'mix' ? pickOne(Math.random, kinds) : choice;
    const candidates = uniqueById(Array.from({ length: 6 }, () => makeClockQuestion(kind, tier, Math.random)));
    return pick(candidates);
  };

  const [question, setQuestion] = useState<ClockQuestion>(() => make(0, 'mix'));
  const [last, setLast] = useState<FeedbackMessage | null>(null);

  const View = question.kind === 'read' ? ClockReadView : ClockSetView;
  return (
    <GameFrame session={session}>
      {rounds === undefined && (
        <ModeChips
          label="Modo"
          value={mode}
          onChange={(next) => {
            setMode(next);
            setQuestion(make(session.round, next));
          }}
          options={[
            { value: 'mix', label: 'Mezcla' },
            { value: 'read', label: 'Leer el reloj' },
            { value: 'set', label: 'Poner la hora' },
          ]}
        />
      )}
      {last && <Feedback message={last} />}
      <View
        key={`${session.round}-${question.kind}-${question.itemId}`}
        question={question}
        onReport={(ok) => {
          setLast(null);
          session.report(question.itemId, CLOCK_ITEM_KIND, question.label, ok);
        }}
        onDone={(firstTry) => {
          setLast(
            firstTry
              ? { tone: 'ok', text: `¡Correcto! Eran ${spanishTime(question.time)}: ${question.reading.kana} (${question.reading.romaji})`, id: session.round }
              : null,
          );
          session.next();
          setQuestion(make(session.round + 1, mode));
        }}
      />
    </GameFrame>
  );
}
