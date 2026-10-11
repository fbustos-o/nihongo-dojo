import { Suspense, useState } from 'react';
import { contentIssues } from '../domain/parseList';
import { loadIssue } from '../state/persistence';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Celebrations } from './Celebrations';
import { ErrorBoundary } from './ErrorBoundary';
import { Loading } from './Loading';
import { useKeyboardOpen } from './useKeyboardOpen';
import styles from './Layout.module.css';

const LINKS = [
  { to: '/', label: 'Inicio', icon: '🏠', end: true },
  { to: '/camino', label: 'Camino', icon: '🗺️' },
  { to: '/repaso', label: 'Repaso', icon: '🔁' },
  { to: '/practica', label: 'Práctica', icon: '✍️' },
  { to: '/ajustes', label: 'Ajustes', icon: '⚙️' },
];

export function Layout() {
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const keyboardOpen = useKeyboardOpen();
  const issues = [loadIssue.message, ...new Set(contentIssues.map((i) => `Contenido: ${i}`))].filter((m): m is string => !!m);
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brand}>
          Nihongo Dojo <span lang="ja">日本語道場</span>
        </span>
        <NavLink to="/acerca-de" className={styles.about}>
          Acerca de
        </NavLink>
      </header>
      <nav className={styles.nav} hidden={keyboardOpen} aria-label="Navegación principal">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
          >
            <span aria-hidden="true">{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className={styles.main}>
        {issues.length > 0 && !dismissed && (
          <div className={styles.banner} role="alert" data-testid="issue-banner">
            <ul>
              {issues.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            <button type="button" className="btn" onClick={() => setDismissed(true)}>
              Entendido
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
