import { Link } from 'react-router-dom';
import { content } from '../domain/contentLoader';
import { computePathNodes, nextLesson } from '../lesson/lessonLogic';
import { useProgress } from '../state/progressStore';

export function HomePage() {
  const xp = useProgress((s) => s.xp);
  const streak = useProgress((s) => s.streak.count);
  const completedIds = useProgress((s) => s.completedLessons);
  const completed = completedIds.length;
  const next = nextLesson(computePathNodes(content.curriculum, completedIds));

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
        {next ? (
          <p>
            Siguiente lección: <Link to={`/leccion/${next.id}`}>{next.title}</Link>
          </p>
        ) : (
          <p className="muted">No hay lecciones disponibles por ahora.</p>
        )}
        <p>
          <Link to="/practica">Ir a la práctica y los repasos</Link>
        </p>
      </section>
    </>
  );
}
