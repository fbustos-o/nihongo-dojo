import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { JaText } from '../components/JaText';
import { content } from '../domain/contentLoader';
import {
  absoluteDate,
  buildLookup,
  categoryCounts,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  memoryRows,
  relativeTime,
  SORT_LABELS,
  sortAndFilter,
  groupFromSlug,
  type ItemLabel,
  type MemoryFilter,
  type MemoryRow,
  type MemorySort,
} from '../review/memoryLogic';
import { useProgress } from '../state/progressStore';
import { SrsHelp } from './SrsHelp';
import styles from './memory.module.css';

const lookup = buildLookup(content);
const kanaRomaji = new Map(content.kana.map((k) => [k.char, k.romaji]));

function ItemView({ label }: { label: ItemLabel }) {
  return (
    <span className={styles.item}>
      <span className={styles.itemMain}>
        {label.ja ? <JaText word={label.ja} /> : <span lang={label.textIsJa ? 'ja' : undefined}>{label.text}</span>}
        {label.reading && (
          <span lang="ja" className={styles.reading}>
            {' '}
            {label.reading}
          </span>
        )}
      </span>
      {label.detail && <span className={`muted ${styles.detail}`}>{label.detail}</span>}
    </span>
  );
}

function NextReview({ row, now }: { row: MemoryRow; now: number }) {
  const [shown, setShown] = useState(false);
  const abs = absoluteDate(row.item.nextDue, row.burned);
  return (
    <button type="button" className={styles.when} title={abs} aria-expanded={shown} onClick={() => setShown((s) => !s)}>
      <span>{relativeTime(row.item.nextDue, now, row.burned)}</span>
      {shown && <small className={styles.abs}>{abs}</small>}
    </button>
  );
}

const accuracyText = (a: number | null): string => (a === null ? '–' : `${a}%`);

export function MemoryPage() {
  const { etapa } = useParams();
  const group = groupFromSlug(etapa);
  const items = useProgress((s) => s.items);
  const [now] = useState(() => Date.now());
  const [sort, setSort] = useState<MemorySort>('next');
  const [filter, setFilter] = useState<MemoryFilter>('all');

  const allRows = useMemo(() => (group ? memoryRows(items, group, lookup, kanaRomaji) : []), [items, group]);
  const counts = useMemo(() => categoryCounts(allRows), [allRows]);
  const rows = useMemo(() => sortAndFilter(allRows, sort, filter), [allRows, sort, filter]);

  if (!group) return <Navigate to="/" replace />;

  return (
    <>
      <p>
        <Link to="/" className={styles.back}>
          ← Inicio
        </Link>
      </p>
      <div className={styles.head}>
        <h1>
          {group} <span className="muted">· {allRows.length}</span>
        </h1>
        <SrsHelp />
      </div>

      {allRows.length === 0 ? (
        <p className="card muted" data-testid="memory-empty">
          Todavía no tienes ítems en {group}. Sigue estudiando y repasando y aparecerán aquí.
        </p>
      ) : (
        <>
          <div className={styles.controls}>
            <label>
              Ordenar por
              <select value={sort} onChange={(e) => setSort(e.target.value as MemorySort)}>
                {(Object.keys(SORT_LABELS) as MemorySort[]).map((s) => (
                  <option key={s} value={s}>
                    {SORT_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tipo
              <select value={filter} onChange={(e) => setFilter(e.target.value as MemoryFilter)}>
                <option value="all">Todos ({allRows.length})</option>
                {CATEGORY_ORDER.filter((c) => counts[c]).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]} ({counts[c]})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {rows.length === 0 ? (
            <p className="muted">Ningún ítem de este tipo en {group}.</p>
          ) : (
            <>
              <ul className={styles.cards} aria-label={`Ítems en ${group}`}>
                {rows.map((row) => (
                  <li key={`${row.item.kind}:${row.item.itemId}`} className={`card ${styles.cardRow}`} data-testid="memory-row">
                    <ItemView label={row.label} />
                    <div className={styles.meta}>
                      <span className={styles.badge}>{CATEGORY_LABELS[row.category]}</span>
                      <span className={styles.badge}>{row.stageName}</span>
                      <span className={styles.badge} aria-label="Precisión">
                        {accuracyText(row.accuracy)}
                      </span>
                    </div>
                    <NextReview row={row} now={now} />
                  </li>
                ))}
              </ul>
              <table className={styles.table}>
                <caption className={styles.srOnly}>Ítems en {group}</caption>
                <thead>
                  <tr>
                    <th scope="col">Ítem</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Etapa</th>
                    <th scope="col">Precisión</th>
                    <th scope="col">Próximo repaso</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.item.kind}:${row.item.itemId}`}>
                      <td>
                        <ItemView label={row.label} />
                      </td>
                      <td>{CATEGORY_LABELS[row.category]}</td>
                      <td>{row.stageName}</td>
                      <td>{accuracyText(row.accuracy)}</td>
                      <td>
                        <NextReview row={row} now={now} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </>
  );
}
