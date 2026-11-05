import { useLang, useT } from '../../i18n';
import { monthName, weekdayShort } from '../../i18n/dates';
import { YEAR, monthGrid } from './calendarLogic';
import styles from './calendar.module.css';

/** Month table with one highlighted day (aria-current="date"). */
export function MonthGrid({ month, day }: { month: number; day: number }) {
  const t = useT();
  const lang = useLang();
  const headers = [0, 1, 2, 3, 4, 5, 6].map((d) => weekdayShort(d, lang));
  const rows = monthGrid(month);
  return (
    <table className={styles.grid} data-testid="month-grid">
      <caption>
        {monthName(month, lang)} {YEAR} ({t('games.monthNumber', { n: month })})
      </caption>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={h} scope="col" className={i === 0 ? styles.sunday : undefined}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, c) => (
              <td key={c} aria-current={cell === day ? 'date' : undefined} className={cell === day ? styles.today : c === 0 ? styles.sunday : undefined}>
                {cell ?? ''}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
