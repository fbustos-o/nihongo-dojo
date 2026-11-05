import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { curriculum } from '../../domain/curriculumContent';
import { content } from '../../domain/contentLoader';
import type { Word } from '../../domain/schema';
import { lessonTitle } from '../../domain/glosses';
import { useLang, useT } from '../../i18n';
import { computePathNodes, nextSuggestions } from '../../lesson/lessonLogic';
import { useNow } from '../../hooks/useNow';
import { localDateString } from '../../state/streak';
import { emptyDaily } from '../../state/daily';
import { learnBatchSize, planToday, selectNewWords } from '../../state/dailyPlan';
import { useProgress } from '../../state/progressStore';
import styles from './today.module.css';

type Action = { to: string; label: string };

/**
 * «Hoy» card: due reviews, today's new words and the next lesson, with ONE primary action
 * (reviews if any are due, else pending new words, else the next lesson) and the other two as secondary links.
 */
export function TodayCard({ vocab = content.vocab }: { vocab?: readonly Word[] }) {
  const t = useT();
  const lang = useLang();
  const items = useProgress((s) => s.items);
  const daily = useProgress((s) => s.daily);
  const knownKana = useProgress((s) => s.knownKana);
  const completed = useProgress((s) => s.completedLessons);
  const perDay = useProgress((s) => s.settings.newWordsPerDay);
  const nowMs = useNow();

  const available = useMemo(() => selectNewWords(vocab, items, new Set(knownKana)).length, [vocab, items, knownKana]);
  const next = useMemo(() => nextSuggestions(computePathNodes(curriculum, completed), completed).next, [completed]);
  const done = (daily[localDateString(new Date(nowMs))] ?? emptyDaily()).newWords;
  const plan = planToday({ items, now: nowMs, newWordsPerDay: perDay, newWordsDone: done, newWordsAvailable: available, nextLesson: next });

  const review: Action | null = plan.reviewsDue > 0 ? { to: '/repaso', label: t('today.review', { n: Math.min(plan.reviewsDue, 50) }) } : null;
  const learn: Action | null = plan.newWordsLeft > 0 ? { to: '/aprender', label: t('today.learn', { n: learnBatchSize(plan.newWordsLeft) }) } : null;
  const lesson: Action | null = plan.nextLesson ? { to: `/leccion/${plan.nextLesson.id}`, label: t('today.startLesson') } : null;
  const order = [review, learn, lesson].filter((a): a is Action => a !== null);
  const [primary, ...secondary] = order;

  return (
    <section className="card" aria-labelledby="today-title" data-testid="today-card">
      <h2 id="today-title">{t('today.title')}</h2>
      <ul className={styles.facts}>
        <li data-testid="today-plan-reviews">{t('today.reviews', { n: plan.reviewsDue })}</li>
        <li data-testid="today-plan-new">{t('today.newWords', { done: plan.newWordsDone, target: plan.newWordsTarget })}</li>
        <li data-testid="today-plan-lesson">
          {plan.nextLesson ? t('today.lesson', { title: lessonTitle(plan.nextLesson, lang) }) : t('today.noLesson')}
        </li>
      </ul>
      <div
        className={styles.bar}
        role="progressbar"
        aria-label={t('today.newWordsBar')}
        aria-valuemin={0}
        aria-valuemax={plan.newWordsTarget}
        aria-valuenow={Math.min(plan.newWordsDone, plan.newWordsTarget)}
      >
        <div className={styles.barFill} style={{ width: plan.newWordsTarget ? `${Math.min(100, (plan.newWordsDone / plan.newWordsTarget) * 100)}%` : '0%' }} />
      </div>
      {primary ? (
        <div className={styles.actions}>
          <Link className={`btn btn-primary ${styles.primary}`} to={primary.to} data-testid="today-primary">
            {primary.label}
          </Link>
          {secondary.map((a) => (
            <Link key={a.to} className="btn" to={a.to}>
              {a.label}
            </Link>
          ))}
        </div>
      ) : (
        <>
          <p className="muted" data-testid="today-done">
            {t('today.allDone')}
          </p>
          <Link className="btn" to="/practica">
            {t('today.practice')}
          </Link>
        </>
      )}
    </section>
  );
}
