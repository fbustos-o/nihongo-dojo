import { useMemo, useRef, useState } from 'react';
import { JaText } from '../../components/JaText';
import { SpeakButton } from '../../components/SpeakButton';
import { useT } from '../../i18n';
import { Feedback, GameFrame, useGameSession, useQuestionPicker, type FeedbackMessage } from '../shared';
import { playSfx } from '../shared/sfx';
import { KanaWithRomaji, ModeChips, ReadingRound, useAutoSpeak } from '../numbers/ReadingRound';
import { pickOne, uniqueById, type Rng } from '../numbers/random';
import numberStyles from '../numbers/numbers.module.css';
import type { GameProps } from '../types';
import { AnalogClock } from './AnalogClock';
import styles from './clock.module.css';
import { CLOCK_ITEM_KIND, clockTierForRound, makeClockQuestion, pad2, parseTimeItemId, sameTime, stepHour, stepMinute, timeText, type ClockQuestion } from './clockLogic';

type ModeChoice = 'mix' | 'read' | 'set';


interface ViewProps {
  question: ClockQuestion;
  rng?: Rng;
  onReport: (correct: boolean) => void;
  onDone: (firstTry: boolean) => void;
}

/** Clock face → type or pick the reading. The time is only in the text alternative after a miss. */
export function ClockReadView({ question, rng, onReport, onDone }: ViewProps) {
  const t = useT();
  const [missed, setMissed] = useState(false);
  const { time } = question;
  const prompt = (
    <>
      <AnalogClock
        h={time.h}
        m={time.m}
        label={missed ? t('games.clockMissed', { time: timeText(time) }) : t('games.clockHidden')}
      />
      <p className={styles.kana}><JaText word={{ kana: 'いま なんじですか？' }} /></p>
      <p className={numberStyles.question}>{t('games.whatTime')}</p>
    </>
  );
  return (
    <ReadingRound
      prompt={prompt}
      reading={question.reading}
      format={question.format}
      related={question.related}
      rng={rng}
      ariaLabel={t('games.timeAria')}
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
  const t = useT();
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
    setMessage({ tone: 'bad', text: t('games.notYet'), id: ++counter.current });
  };

  const buttons: { label: string; apply: () => void }[] = [
    { label: t('games.hourMinus'), apply: () => setH((v) => stepHour(v, -1)) },
    { label: t('games.hourPlus'), apply: () => setH((v) => stepHour(v, 1)) },
    { label: '5 min −', apply: () => setM((v) => stepMinute(v, -5)) },
    { label: '5 min +', apply: () => setM((v) => stepMinute(v, 5)) },
    { label: '1 min −', apply: () => setM((v) => stepMinute(v, -1)) },
    { label: '1 min +', apply: () => setM((v) => stepMinute(v, 1)) },
  ];

  return (
    <div className={numberStyles.question}>
      <div data-testid="prompt">
        <p className={numberStyles.question}>{t('games.setClock')}</p>
        <div className={styles.kanaRow}>
          <p className={styles.kana}><KanaWithRomaji reading={question.reading} /></p>
          <SpeakButton text={question.reading.kana} label={t('games.listenAgain')} />
        </div>
      </div>
      {message && <Feedback message={message} />}
      <div className={styles.setPad}>
        <AnalogClock h={h} m={m} label={t('games.clockSet', { time: timeText({ h, m }) })} />
        <div className={styles.setSide}>
          <p className={styles.caption} role="status" aria-live="polite">
            {t('games.youSet')} <strong data-testid="set-time">{h}:{pad2(m)}</strong>
          </p>
          <div className={styles.controls} role="group" aria-label={t('games.adjustClock')}>
            {buttons.map((b) => (
              <button key={b.label} type="button" className="btn" onClick={b.apply}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className={styles.checkRow}>
        <button type="button" className="btn btn-primary" onClick={check}>
          {t('common.check')}
        </button>
      </p>
    </div>
  );
}

export function Clock({ rounds, sequential, onlyItems, onFinish }: GameProps) {
  const t = useT();
  const session = useGameSession({ rounds, onFinish });
  const pick = useQuestionPicker(CLOCK_ITEM_KIND, sequential);
  const [mode, setMode] = useState<ModeChoice>('mix');
  const kinds = useMemo(() => ['read', 'read', 'set'] as const, []);

  const make = (round: number, choice: ModeChoice): ClockQuestion => {
    const tier = clockTierForRound(round, rounds);
    const kind = choice === 'mix' ? pickOne(Math.random, kinds) : choice;
    // review: round i asks exactly the i-th due time
    const fixed = onlyItems?.[round] ? parseTimeItemId(onlyItems[round]!) : null;
    if (fixed) return makeClockQuestion(kind, tier, Math.random, fixed);
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
          label={t('games.mode')}
          value={mode}
          onChange={(next) => {
            setMode(next);
            setQuestion(make(session.round, next));
          }}
          options={[
            { value: 'mix', label: t('games.mix') },
            { value: 'read', label: t('games.clockRead') },
            { value: 'set', label: t('games.clockSetMode') },
          ]}
        />
      )}
      <Feedback message={last} />
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
              ? { tone: 'ok', text: t('games.clockOk', { time: timeText(question.time), kana: question.reading.kana, romaji: question.reading.romaji }), id: session.round }
              : null,
          );
          session.next();
          setQuestion(make(session.round + 1, mode));
        }}
      />
    </GameFrame>
  );
}
