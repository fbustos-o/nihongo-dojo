import { useEffect } from 'react';
import { playSfx } from '../games/shared/sfx';
import { useCelebrations, type Celebration } from '../state/celebrations';
import styles from './Celebrations.module.css';

const ICON: Record<Celebration['kind'], string> = { level: '⭐', streak: '🔥', lesson: '🎉' };
export const CELEBRATION_MS = 4500;

function Toast({ celebration }: { celebration: Celebration }) {
  const dismiss = useCelebrations((s) => s.dismiss);
  useEffect(() => {
    playSfx('celebrate'); // silent unless the sound setting is on
    const timer = window.setTimeout(() => dismiss(celebration.id), CELEBRATION_MS);
    return () => window.clearTimeout(timer);
  }, [celebration.id, dismiss]);
  return (
    <div className={`${styles.toast} ${styles[celebration.kind]}`} data-testid={`celebration-${celebration.kind}`}>
      <span className={styles.icon} aria-hidden="true">
        {ICON[celebration.kind]}
      </span>
      <span className={styles.text}>
        <strong>{celebration.title}</strong>
        {celebration.detail && <span className="muted">{celebration.detail}</span>}
      </span>
      <button type="button" className={styles.close} aria-label="Cerrar aviso" onClick={() => dismiss(celebration.id)}>
        ×
      </button>
    </div>
  );
}

/**
 * Small celebrations (lesson completed, level up, streak milestone) as a polite status toast, one at a time.
 * The pop-in animation is disabled with prefers-reduced-motion; the sound only plays when the setting is on.
 */
export function Celebrations() {
  const first = useCelebrations((s) => s.queue[0]);
  return (
    <div className={styles.region} role="status" aria-live="polite">
      {first && <Toast key={first.id} celebration={first} />}
    </div>
  );
}
