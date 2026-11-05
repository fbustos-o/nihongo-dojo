import { Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loading } from '../components/Loading';
import { content } from '../domain/contentLoader';
import type { Word } from '../domain/schema';
import { getGame } from '../games/registry';
import type { GameStats } from '../games/types';
import { useT } from '../i18n';
import { roundsFor, weakestItems } from '../lesson/lessonLogic';
import { emptyDaily } from '../state/daily';
import { learnBatchSize, planToday, selectNewWords } from '../state/dailyPlan';
import { useProgress } from '../state/progressStore';
import { localDateString } from '../state/streak';

type Phase = 'cards' | 'read' | 'summary';

/** The batch /aprender works on: the next N new Core words readable with the known kana, in rank order. */
export function pickLearnBatch(vocab: readonly Word[]): Word[] {
  const s = useProgress.getState();
  const done = (s.daily[localDateString(new Date())] ?? emptyDaily()).newWords;
  const plan = planToday({ items: s.items, now: Date.now(), newWordsPerDay: s.settings.newWordsPerDay, newWordsDone: done });
  return selectNewWords(vocab, s.items, new Set(s.knownKana), learnBatchSize(plan.newWordsLeft));
}

/** Page at /aprender: flashcards and then «leer palabras» with today's next new words. */
export function LearnNewPage({ vocab = content.vocab }: { vocab?: readonly Word[] }) {
  const [run, setRun] = useState(0);
  return <LearnRun key={run} vocab={vocab} onAgain={() => setRun((r) => r + 1)} />;
}

function LearnRun({ vocab, onAgain }: { vocab: readonly Word[]; onAgain: () => void }) {
  const t = useT();
  const [words] = useState(() => pickLearnBatch(vocab));
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<Phase>('cards');
  const [stats, setStats] = useState<GameStats[]>([]);

  if (words.length === 0) {
    return (
      <>
        <h1>{t('learn.title')}</h1>
        <p className="card" data-testid="learn-empty">
          {t('learn.empty')}
        </p>
        <Link to="/">{t('learn.home')}</Link>
      </>
    );
  }

  const Game = phase === 'cards' ? getGame('flashcards').component : phase === 'read' ? getGame('read-words').component : undefined;
  const finish = (s: GameStats) => {
    setStats((all) => [...all, s]);
    setPhase(phase === 'cards' ? 'read' : 'summary');
  };
  const weak = weakestItems(stats[stats.length - 1] ?? { total: 0, correct: 0, bestStreak: 0, items: {} }, 8);

  return (
    <>
      <h1>{t('learn.title')}</h1>
      {!started ? (
        <section className="card">
          <p>{t('learn.intro', { n: words.length })}</p>
          <button type="button" className="btn btn-primary" autoFocus onClick={() => setStarted(true)}>
            {t('learn.start')}
          </button>
        </section>
      ) : (
        <>
          <ol aria-label={t('learn.phases')} className="muted" style={{ display: 'flex', gap: '1rem', listStyle: 'none', padding: 0 }}>
            <li aria-current={phase === 'cards' ? 'step' : undefined}>{phase === 'cards' ? <strong>{t('learn.phase.cards')}</strong> : t('learn.phase.cards')}</li>
            <li aria-current={phase === 'read' ? 'step' : undefined}>{phase === 'read' ? <strong>{t('learn.phase.read')}</strong> : t('learn.phase.read')}</li>
          </ol>
          {Game && (
            <Suspense fallback={<Loading />}>
              <Game
                key={phase}
                kana={[]}
                words={words}
                rounds={phase === 'cards' ? words.length : roundsFor(words.length)}
                sequential={phase === 'cards'}
                onFinish={finish}
              />
            </Suspense>
          )}
          {phase === 'summary' && (
            <section className="card" aria-labelledby="learn-summary">
              <h2 id="learn-summary">{t('learn.summaryTitle')}</h2>
              <p data-testid="learn-summary">{t('learn.summary', { n: words.length })}</p>
              {weak.length > 0 && (
                <>
                  <h3>{t('learn.review')}</h3>
                  <ul>
                    {weak.map((w) => (
                      <li key={w.key}>{w.label}</li>
                    ))}
                  </ul>
                </>
              )}
              <div className="row">
                <button type="button" className="btn" onClick={onAgain}>
                  {t('learn.again')}
                </button>
                <Link className="btn btn-primary" to="/">
                  {t('learn.home')}
                </Link>
              </div>
            </section>
          )}
          {phase !== 'summary' && <Link to="/">{t('learn.quit')}</Link>}
        </>
      )}
    </>
  );
}
