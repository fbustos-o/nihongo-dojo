import { content } from '../domain/contentLoader';
import { useProgress } from '../state/progressStore';

export function PathPage() {
  const completed = useProgress((s) => s.completedLessons);
  const { curriculum } = content;

  return (
    <>
      <h1>Camino</h1>
      {curriculum.length === 0 ? (
        <p className="muted">Todavía no hay lecciones cargadas.</p>
      ) : (
        <ol className="card" style={{ paddingLeft: '2rem' }}>
          {curriculum.map((lesson) => {
            const done = completed.includes(lesson.id);
            const open = lesson.requires.every((id) => completed.includes(id));
            return (
              <li key={lesson.id} style={{ opacity: open || done ? 1 : 0.55 }}>
                <strong>{lesson.title}</strong> <span className="muted">· etapa {lesson.stage}</span>{' '}
                {done ? '✅' : open ? '' : '🔒'}
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
