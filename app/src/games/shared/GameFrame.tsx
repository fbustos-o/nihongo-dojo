import type { ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { useT } from '../../i18n';
import type { GameSession } from './useGameSession';
import styles from './games.module.css';

/**
 * Progress bar, streak counter and (endless mode) the "Terminar" button around a game.
 * `stage` (1-5) tints the progress bar with the stage colour; without it the accent colour is used.
 */
export function GameFrame({ session, stage, children }: { session: GameSession; stage?: 1 | 2 | 3 | 4 | 5; children: ReactNode }) {
  const t = useT();
  const { rounds, stats, streak, finish } = session;
  const done = stats.total;
  return (
    <section className={styles.frame} data-stage={stage}>
      <div className={styles.meta}>
        {rounds !== undefined ? (
          <div
            role="progressbar"
            aria-label={t('game.progress')}
            aria-valuemin={0}
            aria-valuemax={rounds}
            aria-valuenow={Math.min(done, rounds)}
            className={styles.bar}
          >
            <div className={styles.barFill} style={{ width: `${Math.min(100, (done / rounds) * 100)}%` }} />
          </div>
        ) : (
          <span className="muted">{t('game.free', { n: done })}</span>
        )}
        <span className={streak > 0 ? `${styles.streak} ${styles.streakOn}` : styles.streak} title={t('game.streakTitle')}>
          <Icon name="flame" size={18} />
          <span>{t('game.streak', { n: streak })}</span>
        </span>
        {rounds === undefined && (
          <button type="button" className="btn" onClick={finish}>
            {t('common.finish')}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
