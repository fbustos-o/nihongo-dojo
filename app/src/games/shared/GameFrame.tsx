import type { ReactNode } from 'react';
import type { GameSession } from './useGameSession';
import styles from './games.module.css';

/** Progress bar, streak counter and (endless mode) the "Terminar" button around a game. */
export function GameFrame({ session, children }: { session: GameSession; children: ReactNode }) {
  const { rounds, stats, streak, finish } = session;
  const done = stats.total;
  return (
    <section className={styles.frame}>
      <div className={styles.meta}>
        {rounds !== undefined ? (
          <div
            role="progressbar"
            aria-label="Progreso"
            aria-valuemin={0}
            aria-valuemax={rounds}
            aria-valuenow={Math.min(done, rounds)}
            className={styles.bar}
          >
            <div className={styles.barFill} style={{ width: `${Math.min(100, (done / rounds) * 100)}%` }} />
          </div>
        ) : (
          <span className="muted">Práctica libre · {done} respondidas</span>
        )}
        <span className={styles.streak} title="Aciertos seguidos">
          <span aria-hidden="true">🔥</span> Racha: {streak}
        </span>
        {rounds === undefined && (
          <button type="button" className="btn" onClick={finish}>
            Terminar
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
