import { content } from '../domain/contentLoader';
import type { KanaEntry } from '../domain/schema';
import styles from './lesson.module.css';

interface KanaChartProps {
  /** Kana of the current lesson (highlighted). */
  highlight: readonly string[];
  /** Kana already known (shown solid; the rest are dimmed). */
  known: ReadonlySet<string>;
  all?: readonly KanaEntry[];
}

/** "Fila" chart: the table rows around the lesson's kana, with the new ones highlighted. */
export function KanaChart({ highlight, known, all = content.kana }: KanaChartProps) {
  const marked = new Set(highlight);
  const involved = all.filter((k) => marked.has(k.char));
  const groups = new Set(involved.map((k) => `${k.script}:${k.group}`));
  const rows = new Map<string, KanaEntry[]>();
  for (const k of all) {
    if (!groups.has(`${k.script}:${k.group}`)) continue;
    const key = `${k.script}:${k.group}:${k.row}`;
    rows.set(key, [...(rows.get(key) ?? []), k]);
  }
  if (involved.length === 0) return null;
  return (
    <div className={styles.chartScroll} role="group" aria-label="Tabla de filas">
      {[...rows.entries()].map(([key, cells]) => (
        <div key={key} className={styles.chartRow}>
          <span className={styles.chartLabel}>{cells[0]!.romaji.replace(/[aiueo]$/, '')}-</span>
          {cells.map((k) => {
            const isNew = marked.has(k.char);
            return (
              <span
                key={k.char}
                lang="ja"
                title={isNew ? `${k.char} (${k.romaji}) — nuevo` : k.romaji}
                className={`${styles.cell} ${isNew ? styles.cellNew : known.has(k.char) ? styles.cellKnown : ''}`}
              >
                {k.char}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
