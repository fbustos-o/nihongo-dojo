import { useState } from 'react';
import { JaText } from '../../components/JaText';
import { readDate, readDayOfWeek } from '../../engine';
import { Feedback, GameFrame, useGameSession, useQuestionPicker, type FeedbackMessage } from '../shared';
import { ModeChips, ReadingRound } from '../numbers/ReadingRound';
import { pickWeighted, uniqueById, type Rng } from '../numbers/random';
import numberStyles from '../numbers/numbers.module.css';
import type { GameProps } from '../types';
import styles from './calendar.module.css';
import { CALENDAR_ITEM_KIND, KIND_LABELS, SPANISH_MONTHS, SPANISH_WEEKDAYS, makeCalendarQuestion, parseDateItemId, weekdayOf, type CalendarKind, type CalendarQuestion } from './calendarLogic';
import { MonthGrid } from './MonthGrid';

type ModeChoice = 'mix' | CalendarKind;
const KIND_WEIGHT: Record<CalendarKind, number> = { date: 4, weekday: 2.5, relWeekday: 1.5, relDate: 2 };
const KINDS = Object.keys(KIND_WEIGHT) as CalendarKind[];

interface ViewProps {
  question: CalendarQuestion;
  rng?: Rng;
  onReport: (correct: boolean) => void;
  onDone: (firstTry: boolean) => void;
}

export function CalendarQuestionView({ question, rng, onReport, onDone }: ViewProps) {
  const { kind, today, direction } = question;
  const dayWord = direction > 0 ? 'あした' : 'きのう';
  const dayEs = direction > 0 ? 'mañana' : 'ayer';
  let prompt;
  let ariaLabel = 'Lectura en hiragana';
  if (kind === 'date') {
    prompt = (
      <>
        <MonthGrid month={today.month} day={today.day} />
        <p className={numberStyles.question}>
          ¿Cómo se lee la fecha marcada ({today.day} de {SPANISH_MONTHS[today.month - 1]})?
        </p>
      </>
    );
  } else if (kind === 'weekday') {
    ariaLabel = 'Día de la semana en hiragana';
    prompt = (
      <>
        <MonthGrid month={today.month} day={today.day} />
        <p className={numberStyles.question}>
          ¿Qué día de la semana es el {today.day} de {SPANISH_MONTHS[today.month - 1]}?
        </p>
      </>
    );
  } else if (kind === 'relWeekday') {
    ariaLabel = 'Día de la semana en hiragana';
    prompt = (
      <>
        <p className={styles.kana}>
          <JaText word={{ kana: `きょうは ${readDayOfWeek(weekdayOf(today)).kana}です。${dayWord}は？` }} />
        </p>
        <p className={numberStyles.question}>Hoy es {readDayOfWeekEs(today)}. ¿Qué día es {dayEs}?</p>
      </>
    );
  } else {
    prompt = (
      <>
        <MonthGrid month={today.month} day={today.day} />
        <p className={styles.kana}>
          <JaText word={{ kana: `きょうは ${readDate(today.month, today.day).kana}です。${dayWord}は？` }} />
        </p>
        <p className={numberStyles.question}>
          Hoy es el {today.day} de {SPANISH_MONTHS[today.month - 1]}. ¿Qué fecha es {dayEs}?
        </p>
      </>
    );
  }
  return (
    <ReadingRound
      prompt={prompt}
      reading={question.reading}
      format={question.format}
      related={question.related}
      rng={rng}
      ariaLabel={ariaLabel}
      onReport={onReport}
      onDone={onDone}
    />
  );
}

const readDayOfWeekEs = (d: { month: number; day: number }) => SPANISH_WEEKDAYS[weekdayOf(d)];

export function Calendar({ rounds, sequential, onlyItems, onFinish }: GameProps) {
  const session = useGameSession({ rounds, onFinish });
  const pick = useQuestionPicker(CALENDAR_ITEM_KIND, sequential);
  const [mode, setMode] = useState<ModeChoice>('mix');

  const make = (choice: ModeChoice, round: number): CalendarQuestion => {
    // review: round i asks exactly the i-th due date item
    const fixed = onlyItems?.[round] ? parseDateItemId(onlyItems[round]!) : null;
    if (fixed) return makeCalendarQuestion(fixed.kind, Math.random, fixed);
    const kind = choice === 'mix' ? pickWeighted(Math.random, KINDS, (k) => KIND_WEIGHT[k]) : choice;
    return pick(uniqueById(Array.from({ length: 6 }, () => makeCalendarQuestion(kind, Math.random))));
  };

  const [question, setQuestion] = useState<CalendarQuestion>(() => make('mix', 0));
  const [last, setLast] = useState<FeedbackMessage | null>(null);

  return (
    <GameFrame session={session}>
      {rounds === undefined && (
        <ModeChips
          label="Modo"
          value={mode}
          onChange={(next) => {
            setMode(next);
            setQuestion(make(next, session.round));
          }}
          options={[{ value: 'mix', label: 'Mezcla' }, ...KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }))]}
        />
      )}
      <Feedback message={last} />
      <CalendarQuestionView
        key={`${session.round}-${question.itemId}`}
        question={question}
        onReport={(ok) => {
          setLast(null);
          session.report(question.itemId, CALENDAR_ITEM_KIND, question.label, ok);
        }}
        onDone={(firstTry) => {
          setLast(firstTry ? { tone: 'ok', text: `¡Correcto! ${question.reading.kana} (${question.reading.romaji})`, id: session.round } : null);
          session.next();
          setQuestion(make(mode, session.round + 1));
        }}
      />
    </GameFrame>
  );
}
