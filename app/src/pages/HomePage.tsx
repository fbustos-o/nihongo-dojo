import { content } from '../domain/contentLoader';
import { useProgress } from '../state/progressStore';

export function HomePage() {
  const xp = useProgress((s) => s.xp);
  const streak = useProgress((s) => s.streak.count);
  const completed = useProgress((s) => s.completedLessons.length);

  return (
    <>
      <h1>
        ようこそ <span className="muted">· Bienvenido</span>
      </h1>
      <section className="card">
        <h2>Tu progreso</h2>
        <p>
          XP: <strong>{xp}</strong> · Racha: <strong>{streak}</strong> {streak === 1 ? 'día' : 'días'} · Lecciones
          completadas: <strong>{completed}</strong> / {content.curriculum.length}
        </p>
      </section>
      <section className="card">
        <h2>Hoy</h2>
        <p className="muted">Aquí aparecerá la cola de repasos y la siguiente lección (próximamente).</p>
      </section>
    </>
  );
}
