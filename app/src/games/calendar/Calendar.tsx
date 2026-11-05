import { useState } from 'react';
import { JaText } from '../../components/JaText';
import { readDate, readDayOfWeek } from '../../engine';
import { useT } from '../../i18n';
import { formatMonthDay, weekdayName } from '../../i18n/dates';
import { Feedback, GameFrame, useGameSession, useQuestionPicker, type FeedbackMessage } from '../shared';
import { ModeChips, ReadingRound } from '../numbers/ReadingRound';
import { pickWeighted, uniqueById, type Rng } from '../numbers/random';
import numberStyles from '../numbers/numbers.module.css';
import type { GameProps } from '../types';
import styles from './calendar.module.css';
import { CALENDAR_ITEM_KIND, kindLabel, makeCalendarQuestion, parseDateItemId, weekdayOf, type CalendarKind, type CalendarQuestion } from './calendarLogic';
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
  const t = useT();
  const { kind, today, direction } = question;
  const dayWord = direction > 0 ? 'あした' : 'きのう';
  const dayRel = t(direction > 0 ? 'games.tomorrow' : 'games.yesterday');
  const date = formatMonthDay(today.month, today.day);
  let prompt;
  let ariaLabel = t('games.hiraReadingAria');
  if (kind === 'date') {
    prompt = (
      <>
        <MonthGrid month={today.month} day={today.day} />
        <p className={numberStyles.question}>
          {t('games.calDate', { date })}
        </p>
      </>
    );
  } else if (kind === 'weekday') {
    ariaLabel = t('games.weekdayAria');
    prompt = (
      <>
        <MonthGrid month={today.month} day={today.day} />
        <p className={numberStyles.question}>
          {t('games.calWeekday', { date })}
        </p>
      </>
    );
  } else if (kind === 'relWeekday') {
    ariaLabel = t('games.weekdayAria');
    prompt = (
      <>
        <p className={styles.kana}>
          <JaText word={{ kana: `きょうは ${readDayOfWeek(weekdayOf(today)).kana}です。${dayWord}は？` }} />
        </p>
        <p className={numberStyles.question}>{t('games.calRelWeekday', { weekday: weekdayName(weekdayOf(today)), rel: dayRel })}</p>
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
          {t('games.calRelDate', { date, rel: dayRel })}
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

export function Calendar({ rounds, sequential, onlyItems, onFinish }: GameProps) {
  const t = useT();
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
          label={t('games.mode')}
          value={mode}
          onChange={(next) => {
            setMode(next);
            setQuestion(make(next, session.round));
          }}
          options={[{ value: 'mix', label: t('games.mix') }, ...KINDS.map((k) => ({ value: k, label: kindLabel(k) }))]}
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
          setLast(firstTry ? { tone: 'ok', text: t('games.correctMsg', { text: `${question.reading.kana} (${question.reading.romaji})` }), id: session.round } : null);
          session.next();
          setQuestion(make(mode, session.round + 1));
        }}
      />
    </GameFrame>
  );
}
