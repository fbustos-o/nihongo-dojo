import { useMemo, useState } from 'react';
import { useNow } from '../hooks/useNow';
import { Link, Navigate, useParams } from 'react-router-dom';
import { JaText } from '../components/JaText';
import { content } from '../domain/contentLoader';
import { useLang, useMeaningLang, useT } from '../i18n';
import {
  absoluteDate,
  buildLookup,
  categoryCounts,
  categoryLabel,
  CATEGORY_ORDER,
  memoryRows,
  relativeTime,
  SORT_ORDER,
  sortLabel,
  sortAndFilter,
  groupFromSlug,
  type ItemLabel,
  type MemoryFilter,
  type MemoryRow,
  type MemorySort,
} from '../review/memoryLogic';
import { srsGroupLabel } from '../review/reviewLogic';
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
  const t = useT();
  const lang = useLang();
  const meaningLang = useMeaningLang();
  const { etapa } = useParams();
  const group = groupFromSlug(etapa);
  const items = useProgress((s) => s.items);
  const now = useNow();
  const [sort, setSort] = useState<MemorySort>('next');
  const [filter, setFilter] = useState<MemoryFilter>('all');

  // lang / meaningLang are not read here but the labels are resolved inside memoryRows, so a language change must recompute them
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allRows = useMemo(() => (group ? memoryRows(items, group, lookup, kanaRomaji) : []), [items, group, lang, meaningLang]);
  const counts = useMemo(() => categoryCounts(allRows), [allRows]);
  const rows = useMemo(() => sortAndFilter(allRows, sort, filter), [allRows, sort, filter]);

  if (!group) return <Navigate to="/" replace />;

  return (
    <>
      <p>
        <Link to="/" className={styles.back}>
          {t('memory.back')}
        </Link>
      </p>
      <div className={styles.head}>
        <h1>
          {srsGroupLabel(group)} <span className="muted">· {allRows.length}</span>
        </h1>
        <SrsHelp />
      </div>

      {allRows.length === 0 ? (
        <p className="card muted" data-testid="memory-empty">
          {t('memory.empty', { group: srsGroupLabel(group) })}
        </p>
      ) : (
        <>
          <div className={styles.controls}>
            <label>
              {t('memory.sortBy')}
              <select value={sort} onChange={(e) => setSort(e.target.value as MemorySort)}>
                {SORT_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {sortLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('memory.type')}
              <select value={filter} onChange={(e) => setFilter(e.target.value as MemoryFilter)}>
                <option value="all">{t('memory.all', { n: allRows.length })}</option>
                {CATEGORY_ORDER.filter((c) => counts[c]).map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)} ({counts[c]})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {rows.length === 0 ? (
            <p className="muted">{t('memory.noneOfType', { group: srsGroupLabel(group) })}</p>
          ) : (
            <>
              <ul className={styles.cards} aria-label={t('memory.itemsIn', { group: srsGroupLabel(group) })}>
                {rows.map((row) => (
                  <li key={`${row.item.kind}:${row.item.itemId}`} className={`card ${styles.cardRow}`} data-testid="memory-row">
                    <ItemView label={row.label} />
                    <div className={styles.meta}>
                      <span className={styles.badge}>{categoryLabel(row.category)}</span>
                      <span className={styles.badge}>{row.stageName}</span>
                      <span className={styles.badge} aria-label={t('memory.accuracy')}>
                        {accuracyText(row.accuracy)}
                      </span>
                    </div>
                    <NextReview row={row} now={now} />
                  </li>
                ))}
              </ul>
              <table className={styles.table}>
                <caption className={styles.srOnly}>{t('memory.itemsIn', { group: srsGroupLabel(group) })}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('memory.colItem')}</th>
                    <th scope="col">{t('memory.type')}</th>
                    <th scope="col">{t('memory.colStage')}</th>
                    <th scope="col">{t('memory.accuracy')}</th>
                    <th scope="col">{t('memory.colNext')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.item.kind}:${row.item.itemId}`}>
                      <td>
                        <ItemView label={row.label} />
                      </td>
                      <td>{categoryLabel(row.category)}</td>
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
