import { handPoint, hourAngle, minuteAngle } from './clockLogic';
import styles from './clock.module.css';

interface AnalogClockProps {
  h: number;
  m: number;
  /** Accessible text alternative. Do not reveal the time here while it is the question. */
  label: string;
}

/** SVG analog clock with hour and minute hands and numerals 1-12. */
export function AnalogClock({ h, m, label }: AnalogClockProps) {
  const hourEnd = handPoint(hourAngle(h, m), 48);
  const minuteEnd = handPoint(minuteAngle(m), 72);
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label={label} className={styles.clock} data-testid="analog-clock">
      <circle cx="100" cy="100" r="95" className={styles.face} />
      {Array.from({ length: 60 }, (_, i) => {
        const outer = handPoint(i * 6, 92);
        const inner = handPoint(i * 6, i % 5 === 0 ? 85 : 89);
        return <line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} className={i % 5 === 0 ? styles.tickMajor : styles.tick} />;
      })}
      {Array.from({ length: 12 }, (_, i) => {
        const p = handPoint((i + 1) * 30, 72);
        return (
          <text key={i} x={p.x} y={p.y} className={styles.numeral} textAnchor="middle" dominantBaseline="central">
            {i + 1}
          </text>
        );
      })}
      <line x1="100" y1="100" x2={hourEnd.x} y2={hourEnd.y} className={styles.hourHand} data-testid="hour-hand" />
      <line x1="100" y1="100" x2={minuteEnd.x} y2={minuteEnd.y} className={styles.minuteHand} data-testid="minute-hand" />
      <circle cx="100" cy="100" r="4" className={styles.hub} />
    </svg>
  );
}
