import { Suspense, useState } from 'react';
import { contentIssues } from '../domain/parseList';
import { loadIssue, useSaveStatus } from '../state/persistence';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Celebrations } from './Celebrations';
import { ErrorBoundary } from './ErrorBoundary';
import { useT } from '../i18n';
import { Icon, type IconName } from './Icon';
import { LangSwitch } from './LangSwitch';
import { Loading } from './Loading';
import { useKeyboardOpen } from './useKeyboardOpen';
import styles from './Layout.module.css';

/** `short`: label of the bottom tab bar on phones, where six entries leave ~60 px each (QA-111: «Vocabul…»). */
const LINKS: { to: string; label: string; short?: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'nav.home', icon: 'home', end: true },
  { to: '/camino', label: 'nav.path', icon: 'map' },
  { to: '/vocabulario', label: 'nav.vocab', short: 'nav.vocabShort', icon: 'vocab' },
  { to: '/repaso', label: 'nav.review', icon: 'repeat' },
  { to: '/practica', label: 'nav.practice', icon: 'pencil' },
  { to: '/ajustes', label: 'nav.settings', icon: 'settings' },
];

export function Layout() {
  const t = useT();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const keyboardOpen = useKeyboardOpen();
  const saveFailed = useSaveStatus((s) => s.failed);
  const issues = [loadIssue.message, ...new Set(contentIssues.map((i) => t('layout.contentIssue', { issue: i })))].filter((m): m is string => !!m);
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brand}>
          <span className={styles.seal} lang="ja" aria-hidden="true">
            道
          </span>
          <span className={styles.brandText}>
            {t('app.name')} <span lang="ja">日本語道場</span>
            {import.meta.env.VITE_CHANNEL && <span className={styles.channel}>{import.meta.env.VITE_CHANNEL} beta</span>}
          </span>
        </span>
        <div className={styles.tools}>
          <LangSwitch />
          <NavLink to="/acerca-de" className={styles.about}>
            <Icon name="info" size={16} />
            {t('nav.about')}
          </NavLink>
        </div>
      </header>
      <nav className={styles.nav} hidden={keyboardOpen} aria-label={t('nav.main')}>
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
            aria-label={link.short ? t(link.label) : undefined}
          >
            <span className={styles.iconWrap}>
              <Icon name={link.icon} size={22} />
            </span>
            {link.short ? (
              <span className={styles.label} aria-hidden="true">
                <span className={styles.long}>{t(link.label)}</span>
                <span className={styles.short}>{t(link.short)}</span>
              </span>
            ) : (
              <span className={styles.label}>{t(link.label)}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <main className={styles.main}>
        {saveFailed && (
          <div className={styles.banner} role="alert" data-testid="save-banner">
            <p>
              {t('layout.saveFailedBefore')} <NavLink to="/ajustes">{t('nav.settings')}</NavLink> {t('layout.saveFailedAfter')}
            </p>
          </div>
        )}
        {issues.length > 0 && !dismissed && (
          <div className={styles.banner} role="alert" data-testid="issue-banner">
            <ul>
              {issues.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            <button type="button" className="btn" onClick={() => setDismissed(true)}>
              {t('common.ok')}
            </button>
          </div>
        )}
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <Celebrations />
    </div>
  );
}
