import { Suspense, useMemo, useState } from 'react';
import { Loading } from '../components/Loading';
import { Link, useSearchParams } from 'react-router-dom';
import { content } from '../domain/contentLoader';
import { GAME_REGISTRY } from '../games/registry';
import type { GameStats } from '../games/types';
import { accuracyOf, mergeStats, weakestItems, xpEarned } from '../lesson/lessonLogic';
import { useProgress } from '../state/progressStore';
import { BATCH_UNIT, REVIEW_GROUP_LABELS, batchProps, dueCountsByGroup, planReview, type BatchProps, type ReviewBatch, type ReviewGroupId } from './reviewLogic';
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
    const meta = GAME_REGISTRY[current.batch.game];
    const Game = meta.component!;
    const finish = (stats: GameStats) => {
      const all = [...results, stats];
      if (index + 1 < batches.length) setPhase({ name: 'running', batches, index: index + 1, results: all });
      else setPhase({ name: 'summary', results: all, stillDue: dueCountsByGroup(useProgress.getState().items, Date.now()).total });
    };
    return (
      <>
        <div className={styles.head}>
          <h1>Repaso</h1>
          <Link to="/">Salir</Link>
        </div>
        <p className="muted" data-testid="review-step">
          Parte {index + 1} de {batches.length}: <strong>{meta.name}</strong> · {current.props.rounds} {BATCH_UNIT[current.batch.game] ?? 'ítems'}
        </p>
        <Suspense fallback={<Loading label="Cargando juego…" />}>
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
        <h1>Repaso terminado</h1>
        <section className={`card ${styles.summary}`} aria-labelledby="review-summary">
          <h2 id="review-summary">{accuracy >= 80 ? '¡Buen repaso!' : 'Sigue repasando'}</h2>
          <p className={styles.score}>{accuracy}%</p>
          <p>
            Aciertos: {stats.correct} de {stats.total} · XP ganado: <strong>+{xpEarned(stats)}</strong> · Mejor racha: {stats.bestStreak}
          </p>
          {weak.length > 0 && (
            <>
              <h3>Para reforzar</h3>
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
                Seguir repasando ({stillDue} pendientes)
              </button>
            )}
            <Link className="btn" to="/">
              Volver al inicio
            </Link>
          </div>
        </section>
      </>
    );
  }

  const scope = group ? ` de ${REVIEW_GROUP_LABELS[group].toLowerCase()}` : '';
  return (
    <>
      <h1>Repaso</h1>
      {plan.total === 0 ? (
        <section className="card" data-testid="review-empty">
          <h2>No tienes repasos pendientes{scope}</h2>
          <p className="muted">Los ítems que aprendes vuelven a aparecer aquí cuando toca repasarlos.</p>
          <div className={styles.actions}>
            <Link className="btn btn-primary" to="/camino">
              Ir al camino
            </Link>
            <Link className="btn" to="/practica">
              Práctica libre
            </Link>
          </div>
        </section>
      ) : (
        <section className="card" aria-labelledby="review-plan">
          <h2 id="review-plan">
            {plan.total} {plan.total === 1 ? 'ítem' : 'ítems'} por repasar{scope}
          </h2>
          {counts.total > plan.total && <p className="muted">Cada sesión tiene un máximo de 50; te quedarán {counts.total - plan.total} para la siguiente.</p>}
          <ul className={styles.plan}>
            {plan.batches.map((b) => (
              <li key={b.game}>
                <strong>{GAME_REGISTRY[b.game].name}</strong> <span className="muted">· {b.itemIds.length} {BATCH_UNIT[b.game] ?? 'ítems'}</span>
              </li>
            ))}
          </ul>
          <div className={styles.actions}>
            <button type="button" className="btn btn-primary" autoFocus onClick={start}>
              Empezar repaso
            </button>
            <Link className="btn" to="/">
              Volver
            </Link>
          </div>
        </section>
      )}
    </>
  );
}

