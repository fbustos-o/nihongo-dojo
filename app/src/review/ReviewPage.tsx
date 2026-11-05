import { Suspense, useMemo, useState } from 'react';
import { Loading } from '../components/Loading';
import { Link, useSearchParams } from 'react-router-dom';
import { content } from '../domain/contentLoader';
import { useT } from '../i18n';
import { gameName, getGame } from '../games/registry';
import type { GameStats } from '../games/types';
import { accuracyOf, mergeStats, weakestItems, xpEarned } from '../lesson/lessonLogic';
import { useProgress } from '../state/progressStore';
import { batchUnit, reviewGroupLabel, batchProps, dueCountsByGroup, planReview, type BatchProps, type ReviewBatch, type ReviewGroupId } from './reviewLogic';
import styles from './review.module.css';

/** `?grupo=` values (Spanish, for readable links) -> dashboard group. */
export const GROUP_PARAM: Record<string, ReviewGroupId> = { kana: 'kana', palabras: 'words', patrones: 'patterns', kanji: 'kanji' };
export const groupParam = (group: ReviewGroupId): string => Object.keys(GROUP_PARAM).find((k) => GROUP_PARAM[k] === group)!;

interface RunBatch {
  batch: ReviewBatch;
  props: BatchProps;
}

type Phase = { name: 'intro' } | { name: 'running'; batches: RunBatch[]; index: number; results: GameStats[] } | { name: 'summary'; results: GameStats[]; stillDue: number };

/** Route /repaso: the unified SRS review (every due item, up to 50), one game after another. */
export function ReviewPage() {
  const t = useT();
  const [params] = useSearchParams();
  const group = GROUP_PARAM[params.get('grupo') ?? ''];
  const items = useProgress((s) => s.items);
  const [now, setNow] = useState(() => Date.now());
  const [phase, setPhase] = useState<Phase>({ name: 'intro' });

  const plan = useMemo(() => planReview(items, now, { group }), [items, now, group]);
  const counts = useMemo(() => dueCountsByGroup(items, now), [items, now]);

  const resolve = (): RunBatch[] =>
    planReview(useProgress.getState().items, Date.now(), { group }).batches.flatMap((batch) => {
      const props = batchProps(batch, content);
      return props ? [{ batch, props }] : [];
    });

  const start = () => {
    const batches = resolve();
    if (batches.length > 0) setPhase({ name: 'running', batches, index: 0, results: [] });
  };

  if (phase.name === 'running') {
    const { batches, index, results } = phase;
    const current = batches[index]!;
    const Game = getGame(current.batch.game).component!;
    const finish = (stats: GameStats) => {
      const all = [...results, stats];
      if (index + 1 < batches.length) setPhase({ name: 'running', batches, index: index + 1, results: all });
      else setPhase({ name: 'summary', results: all, stillDue: dueCountsByGroup(useProgress.getState().items, Date.now()).total });
    };
    return (
      <>
        <div className={styles.head}>
          <h1>{t('review.title')}</h1>
          <Link to="/">{t('review.exit')}</Link>
        </div>
        <p className="muted" data-testid="review-step">
          {t('review.part', { i: index + 1, n: batches.length })} <strong>{gameName(current.batch.game)}</strong> · {current.props.rounds} {batchUnit(current.batch.game)}
        </p>
        <Suspense fallback={<Loading label={t('games.loading')} />}>
        <Game
          key={`${index}-${current.batch.game}`}
          kana={current.props.kana}
          kanji={current.props.kanji}
          words={current.props.words}
          patterns={current.props.patterns}
          dialogueIds={current.props.dialogueIds}
          onlyItems={current.props.onlyItems}
          rounds={current.props.rounds}
          sequential
          onFinish={finish}
        />
        </Suspense>
      </>
    );
  }

  if (phase.name === 'summary') {
    const stats = mergeStats(phase.results);
    const weak = weakestItems(stats);
    const accuracy = Math.round(accuracyOf(stats) * 100);
    const { stillDue } = phase;
    return (
      <>
        <h1>{t('review.done')}</h1>
        <section className={`card ${styles.summary}`} aria-labelledby="review-summary">
          <h2 id="review-summary">{accuracy >= 80 ? t('review.good') : t('review.keepGoing')}</h2>
          <p className={styles.score}>{accuracy}%</p>
          <p>
            {t('games.hits', { correct: stats.correct, total: stats.total })}{t('games.xpEarned')}<strong>+{xpEarned(stats)}</strong>{t('games.bestStreak', { n: stats.bestStreak })}
          </p>
          {weak.length > 0 && (
            <>
              <h3>{t('review.reinforce')}</h3>
              <ul className={styles.weak}>
                {weak.map((w) => (
                  <li key={w.key}>
                    {w.label} <span className="muted">× {w.wrong}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className={styles.actions}>
            {stillDue > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                autoFocus
                onClick={() => {
                  setNow(Date.now());
                  setPhase({ name: 'intro' });
                }}
              >
                {t('review.continue', { n: stillDue })}
              </button>
            )}
            <Link className="btn" to="/">
              {t('review.backHome')}
            </Link>
          </div>
        </section>
      </>
    );
  }

  const scope = group ? t('review.scope', { group: reviewGroupLabel(group).toLowerCase() }) : '';
  return (
    <>
      <h1>{t('review.title')}</h1>
      {plan.total === 0 ? (
        <section className="card" data-testid="review-empty">
          <h2>{t('review.emptyTitle', { scope })}</h2>
          <p className="muted">{t('review.emptyNote')}</p>
          <div className={styles.actions}>
            <Link className="btn btn-primary" to="/camino">
              {t('review.toPath')}
            </Link>
            <Link className="btn" to="/practica">
              {t('home.freePractice')}
            </Link>
          </div>
        </section>
      ) : (
        <section className="card" aria-labelledby="review-plan">
          <h2 id="review-plan">
            {t(plan.total === 1 ? 'review.planOne' : 'review.planMany', { n: plan.total, scope })}
          </h2>
          {counts.total > plan.total && <p className="muted">{t('review.maxNote', { n: counts.total - plan.total })}</p>}
          <ul className={styles.plan}>
            {plan.batches.map((b) => (
              <li key={b.game}>
                <strong>{gameName(b.game)}</strong> <span className="muted">· {b.itemIds.length} {batchUnit(b.game)}</span>
              </li>
            ))}
          </ul>
          <div className={styles.actions}>
            <button type="button" className="btn btn-primary" autoFocus onClick={start}>
              {t('review.start')}
            </button>
            <Link className="btn" to="/">
              {t('common.back')}
            </Link>
          </div>
        </section>
      )}
    </>
  );
}

