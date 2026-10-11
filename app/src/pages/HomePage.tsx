import { useMemo } from 'react';
import { useNow } from '../hooks/useNow';
import { Link } from 'react-router-dom';
import { curriculum } from '../domain/curriculumContent';
import { levelFromXp } from '../engine/levels';
import { computePathNodes, nextLesson, STAGE_TITLES, stageProgress } from '../lesson/lessonLogic';
import { groupSlug } from '../review/memoryLogic';
import { dueCountsByGroup, REVIEW_GROUP_IDS, REVIEW_GROUP_LABELS, SRS_GROUPS, srsDistribution } from '../review/reviewLogic';
import { dailyAccuracy, emptyDaily, lastSevenDays } from '../state/daily';
import { localDateString } from '../state/streak';
import { useProgress } from '../state/progressStore';
import { SrsHelp } from './SrsHelp';
import styles from './home.module.css';

const pct = (n: number, total: number): string => (total ? `${Math.round((n / total) * 100)}%` : '0%');

export function HomePage() {
  const xp = useProgress((s) => s.xp);
  const streak = useProgress((s) => s.streak);
  const daily = useProgress((s) => s.daily);
  const items = useProgress((s) => s.items);
  const completedIds = useProgress((s) => s.completedLessons);
  const nowMs = useNow();
  const now = useMemo(() => new Date(nowMs), [nowMs]);

  const level = levelFromXp(xp);
  const week = useMemo(() => lastSevenDays(daily, streak, now), [daily, streak, now]);
  const today = daily[localDateString(now)] ?? emptyDaily();
  const due = useMemo(() => dueCountsByGroup(items, now.getTime()), [items, now]);
  const srs = useMemo(() => srsDistribution(items), [items]);
  const srsTotal = Object.values(srs).reduce((a, b) => a + b, 0);
  const next = nextLesson(computePathNodes(curriculum, completedIds));
  const stages = stageProgress(curriculum, completedIds);
  // a streak only counts while it is alive (studied today or yesterday)
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const alive = streak.lastStudyDate === localDateString(now) || streak.lastStudyDate === localDateString(yesterday);
  const streakDays = alive ? streak.count : 0;

  return (
    <>
      <h1>
        ようこそ <span className="muted">· Bienvenido</span>
      </h1>

      <section className={`card ${styles.level}`} aria-labelledby="home-level">
        <div className={styles.levelHead}>
          <h2 id="home-level">
            Nivel <span data-testid="level">{level.level}</span>
          </h2>
          <span className="muted" data-testid="xp-text">
            {level.xpInto} / {level.xpNeeded} XP · {xp} en total
          </span>
        </div>
        <div className={styles.bar} role="progressbar" aria-label="Experiencia del nivel" aria-valuemin={0} aria-valuemax={level.xpNeeded} aria-valuenow={level.xpInto}>
          <div className={styles.barFill} style={{ width: `${level.progress * 100}%` }} />
        </div>
      </section>

      <section className="card" aria-labelledby="home-streak">
        <div className={styles.levelHead}>
          <h2 id="home-streak">Racha</h2>
          <span data-testid="streak">
            <strong>{streakDays}</strong> {streakDays === 1 ? 'día' : 'días'}
          </span>
        </div>
        <ol className={styles.week} aria-label="Últimos 7 días">
          {week.map((d) => (
            <li key={d.date} className={`${styles.day} ${d.active ? styles.dayOn : ''} ${d.today ? styles.dayToday : ''}`} aria-label={`${d.label}${d.today ? ' (hoy)' : ''}: ${d.active ? 'estudiaste' : 'sin estudio'}`}>
              <span aria-hidden="true">{d.label}</span>
              <span aria-hidden="true" className={styles.dot}>
                {d.active ? '✓' : ''}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card" aria-labelledby="home-due">
        <h2 id="home-due">Repasos pendientes</h2>
        <p className={styles.big} data-testid="due-total">
          {due.total}
        </p>
        {due.total > 0 ? (
          <ul className={styles.chips} aria-label="Pendientes por tipo">
            {REVIEW_GROUP_IDS.map((g) => (
              <li key={g}>
                {REVIEW_GROUP_LABELS[g]} <strong>{due[g]}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Nada pendiente por ahora. Los ítems vuelven cuando toca repasarlos.</p>
        )}
        {due.total > 0 ? (
          <Link className={`btn btn-primary ${styles.cta}`} to="/repaso">
            Repasar ahora ({Math.min(due.total, 50)})
          </Link>
        ) : (
          <Link className={`btn ${styles.cta}`} to="/practica">
            Práctica libre
          </Link>
        )}
      </section>

      <section className="card" aria-labelledby="home-next">
        <h2 id="home-next">Siguiente lección</h2>
        {next ? (
          <>
            <p className={styles.lessonTitle}>{next.title}</p>
            <p className="muted">
              Etapa {next.stage} · {STAGE_TITLES[next.stage]}
            </p>
            <Link className={`btn btn-primary ${styles.cta}`} to={`/leccion/${next.id}`}>
              Empezar
            </Link>
          </>
        ) : (
          <p className="muted">No hay más lecciones disponibles por ahora. Sigue repasando.</p>
        )}
      </section>

      <section className="card" aria-labelledby="home-today">
        <h2 id="home-today">Hoy</h2>
        <dl className={styles.stats}>
          <div>
            <dt>Repasos</dt>
            <dd data-testid="today-reviews">{today.reviews}</dd>
          </div>
          <div>
            <dt>Lecciones</dt>
            <dd data-testid="today-lessons">{today.lessons}</dd>
          </div>
          <div>
            <dt>Precisión</dt>
            <dd data-testid="today-accuracy">{today.correct + today.wrong === 0 ? '–' : `${Math.round(dailyAccuracy(today) * 100)}%`}</dd>
          </div>
        </dl>
      </section>

      <section className="card" aria-labelledby="home-srs">
        <div className={styles.levelHead}>
          <h2 id="home-srs">Tu memoria</h2>
          <SrsHelp />
        </div>
        {srsTotal === 0 ? (
          <p className="muted">Aún no hay ítems en tu repaso. Completa una lección para empezar.</p>
        ) : (
          <ul className={styles.srs}>
            {SRS_GROUPS.map((g) => (
              <li key={g} className={styles[`srs${g}`]} data-testid={`srs-${g}`}>
                <Link to={`/memoria/${groupSlug(g)}`} className={styles.srsLink} aria-label={`${g}: ${srs[g]} ítems. Ver detalle`}>
                  <strong>{srs[g]}</strong>
                  <span>{g}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="home-stages">
        <h2 id="home-stages">Progreso por etapa</h2>
        <ul className={styles.stages}>
          {stages.map(({ stage, total, done }) => (
            <li key={stage}>
              <div className={styles.levelHead}>
                <span>{STAGE_TITLES[stage]}</span>
                <span className="muted">
                  {done} / {total}
                </span>
              </div>
              <div className={styles.bar} role="progressbar" aria-label={`Progreso de ${STAGE_TITLES[stage]}`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
                <div className={styles.barFill} style={{ width: pct(done, total) }} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
