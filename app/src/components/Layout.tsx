import { NavLink, Outlet } from 'react-router-dom';
import styles from './Layout.module.css';

const LINKS = [
  { to: '/', label: 'Inicio', icon: '🏠', end: true },
  { to: '/camino', label: 'Camino', icon: '🗺️' },
  { to: '/practica', label: 'Práctica', icon: '✍️' },
  { to: '/ajustes', label: 'Ajustes', icon: '⚙️' },
  { to: '/acerca-de', label: 'Acerca de', icon: 'ℹ️' },
];

export function Layout() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brand}>
          Nihongo Dojo <span lang="ja">日本語道場</span>
        </span>
      </header>
      <nav className={styles.nav} aria-label="Navegación principal">
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
        <Outlet />
      </main>
    </div>
  );
}
