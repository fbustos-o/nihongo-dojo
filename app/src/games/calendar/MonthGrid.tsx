import { SPANISH_MONTHS, YEAR, monthGrid } from './calendarLogic';
import styles from './calendar.module.css';

const HEADERS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Month table with one highlighted day (aria-current="date"). */
export function MonthGrid({ month, day }: { month: number; day: number }) {
  const rows = monthGrid(month);
  return (
    <table className={styles.grid} data-testid="month-grid">
      <caption>
        {SPANISH_MONTHS[month - 1]} {YEAR} (mes {month})
      </caption>
      <thead>
        <tr>
          {HEADERS.map((h, i) => (
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
