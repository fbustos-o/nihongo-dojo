import { useMemo } from 'react';
import { useNow } from '../hooks/useNow';
import { Link } from 'react-router-dom';
import { weekdayInitial } from '../i18n/dates';
import { useLang, useT } from '../i18n';
import { curriculum } from '../domain/curriculumContent';
import { levelFromXp } from '../engine/levels';
import { lessonTitle } from '../domain/glosses';
import { computePathNodes, nextSuggestions, stageProgress } from '../lesson/lessonLogic';
import { groupSlug } from '../review/memoryLogic';
import { dueCountsByGroup, REVIEW_GROUP_IDS, reviewGroupLabel, SRS_GROUPS, srsDistribution, srsGroupLabel } from '../review/reviewLogic';
import { dailyAccuracy, emptyDaily, lastSevenDays } from '../state/daily';
import { localDateString } from '../state/streak';
import { useProgress } from '../state/progressStore';
import { SrsHelp } from './SrsHelp';
import { TodayCard } from './home/TodayCard';
import styles from './home.module.css';

const pct = (n: number, total: number): string => (total ? `${Math.round((n / total) * 100)}%` : '0%');

const weekdayOfDate = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).getDay();
};

export function HomePage() {
  const t = useT();
  const lang = useLang();
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
  const { kana: nextKana, grammar: nextGrammar, next } = nextSuggestions(computePathNodes(curriculum, completedIds), completedIds);
  const other = next && nextKana && nextGrammar ? (next === nextKana ? nextGrammar : nextKana) : undefined;
  const stages = stageProgress(curriculum, completedIds);
  // a streak only counts while it is alive (studied today or yesterday)
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const alive = streak.lastStudyDate === localDateString(now) || streak.lastStudyDate === localDateString(yesterday);
  const streakDays = alive ? streak.count : 0;

  return (
    <>
      <h1>
        ようこそ <span className="muted">· {t('home.welcome')}</span>
      </h1>

      <TodayCard />

      <section className={`card ${styles.level}`} aria-labelledby="home-level">
        <div className={styles.levelHead}>
          <h2 id="home-level">
            {t('home.level')} <span data-testid="level">{level.level}</span>
          </h2>
          <span className="muted" data-testid="xp-text">
            {t('home.xpText', { into: level.xpInto, needed: level.xpNeeded, total: xp })}
          </span>
        </div>
        <div className={styles.bar} role="progressbar" aria-label={t('home.xpBar')} aria-valuemin={0} aria-valuemax={level.xpNeeded} aria-valuenow={level.xpInto}>
          <div className={styles.barFill} style={{ width: `${level.progress * 100}%` }} />
        </div>
      </section>

      <section className="card" aria-labelledby="home-streak">
        <div className={styles.levelHead}>
          <h2 id="home-streak">{t('home.streak')}</h2>
          <span data-testid="streak">
            <strong>{streakDays}</strong> {streakDays === 1 ? t('home.dayOne') : t('home.dayMany')}
          </span>
        </div>
        <ol className={styles.week} aria-label={t('home.last7')}>
          {week.map((d) => (
            <li key={d.date} className={`${styles.day} ${d.active ? styles.dayOn : ''} ${d.today ? styles.dayToday : ''}`} aria-label={`${weekdayInitial(weekdayOfDate(d.date), lang)}${d.today ? t('home.todaySuffix') : ''}: ${d.active ? t('home.studied') : t('home.notStudied')}`}>
              <span aria-hidden="true">{weekdayInitial(weekdayOfDate(d.date), lang)}</span>
              <span aria-hidden="true" className={styles.dot}>
                {d.active ? '✓' : ''}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card" aria-labelledby="home-due">
        <h2 id="home-due">{t('home.due')}</h2>
        <p className={styles.big} data-testid="due-total">
          {due.total}
        </p>
        {due.total > 0 ? (
          <ul className={styles.chips} aria-label={t('home.dueByType')}>
            {REVIEW_GROUP_IDS.map((g) => (
              <li key={g}>
                {reviewGroupLabel(g)} <strong>{due[g]}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t('home.dueNone')}</p>
        )}
        {/* The primary "review now" action lives in <TodayCard>; here only the free-practice shortcut remains. */}
        {due.total === 0 && (
          <Link className={`btn ${styles.cta}`} to="/practica">
            {t('home.freePractice')}
          </Link>
        )}
      </section>

      <section className="card" aria-labelledby="home-next">
        <h2 id="home-next">{t('home.nextLesson')}</h2>
        {next ? (
          <>
            <p className={styles.lessonTitle}>{lessonTitle(next, lang)}</p>
            <p className="muted">
              {t('home.stageLine', { n: next.stage, title: t(`stage.${next.stage}`) })}
            </p>
            <Link className={`btn btn-primary ${styles.cta}`} to={`/leccion/${next.id}`}>
              {t('home.start')}
            </Link>
            {other && (
              <p className="muted" data-testid="next-other">
                {other === nextGrammar ? t('home.nextGrammar') : t('home.nextKana')}:{' '}
                <Link to={`/leccion/${other.id}`}>{lessonTitle(other, lang)}</Link>
              </p>
            )}
          </>
        ) : (
          <p className="muted">{t('home.noMore')}</p>
        )}
      </section>

      <section className="card" aria-labelledby="home-today">
        <h2 id="home-today">{t('home.today')}</h2>
        <dl className={styles.stats}>
          <div>
            <dt>{t('home.statReviews')}</dt>
            <dd data-testid="today-reviews">{today.reviews}</dd>
          </div>
          <div>
            <dt>{t('home.statLessons')}</dt>
            <dd data-testid="today-lessons">{today.lessons}</dd>
          </div>
          <div>
            <dt>{t('home.statAccuracy')}</dt>
            <dd data-testid="today-accuracy">{today.correct + today.wrong === 0 ? '–' : `${Math.round(dailyAccuracy(today) * 100)}%`}</dd>
          </div>
        </dl>
      </section>

      <section className="card" aria-labelledby="home-srs">
        <div className={styles.levelHead}>
          <h2 id="home-srs">{t('home.memory')}</h2>
          <SrsHelp />
        </div>
        {srsTotal === 0 ? (
          <p className="muted">{t('home.memoryEmpty')}</p>
        ) : (
          <ul className={styles.srs}>
            {SRS_GROUPS.map((g) => (
              <li key={g} className={styles[`srs${g}`]} data-testid={`srs-${g}`}>
                <Link to={`/memoria/${groupSlug(g)}`} className={styles.srsLink} aria-label={t('home.srsAria', { group: srsGroupLabel(g), n: srs[g] })}>
                  <strong>{srs[g]}</strong>
                  <span>{srsGroupLabel(g)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="home-stages">
        <h2 id="home-stages">{t('home.stages')}</h2>
        <ul className={styles.stages}>
          {stages.map(({ stage, total, done }) => (
            <li key={stage}>
              <div className={styles.levelHead}>
                <span>{t(`stage.${stage}`)}</span>
                <span className="muted">
                  {done} / {total}
                </span>
              </div>
              <div className={styles.bar} role="progressbar" aria-label={t('home.stageProgress', { title: t(`stage.${stage}`) })} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
                <div className={styles.barFill} style={{ width: pct(done, total) }} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
