import { Link } from 'react-router-dom';
import { content } from '../domain/contentLoader';
import { computePathNodes, nextLesson, STAGE_TITLES, stageProgress, type LessonNode } from '../lesson/lessonLogic';
import styles from '../lesson/lesson.module.css';
import { useProgress } from '../state/progressStore';

function Node({ node, current }: { node: LessonNode; current: boolean }) {
  const { lesson, status, playable, comingSoon } = node;
  const icon = status === 'completed' ? '✓' : status === 'locked' ? '🔒' : comingSoon ? '⏳' : '▶';
  const label = status === 'completed' ? 'Completada' : status === 'locked' ? 'Bloqueada' : comingSoon ? 'Próximamente' : 'Disponible';
  const body = (
    <>
      <span className={styles.nodeIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.nodeBody}>
        <strong>{lesson.title}</strong>
        <span className={styles.nodeState}>{current ? 'Siguiente lección' : label}</span>
      </span>
    </>
  );
  const cls = `${styles.node} ${status === 'locked' ? styles.nodeLocked : ''} ${status === 'completed' ? styles.nodeDone : ''} ${current ? styles.nodeCurrent : ''}`;
  if (status !== 'locked' && playable) {
    return (
      <Link to={`/leccion/${lesson.id}`} className={cls} aria-current={current ? 'step' : undefined}>
        {body}
      </Link>
    );
  }
  return (
    <div className={cls} aria-disabled="true">
      {body}
    </div>
  );
}

export function PathPage() {
  const completed = useProgress((s) => s.completedLessons);
  const { curriculum } = content;
  const nodes = computePathNodes(curriculum, completed);
  const currentId = nextLesson(nodes)?.id;

  if (curriculum.length === 0) {
    return (
      <>
        <h1>Camino</h1>
        <p className="muted">Todavía no hay lecciones cargadas.</p>
      </>
    );
  }

  return (
    <>
      <h1>Camino</h1>
      {stageProgress(curriculum, completed).map(({ stage, total, done }) => (
        <section key={stage} className={styles.stage} aria-labelledby={`stage-${stage}`}>
          <div className={styles.stageHead}>
            <h2 id={`stage-${stage}`}>
              {stage}. {STAGE_TITLES[stage]}
            </h2>
            <div
              className={styles.stageBar}
              role="progressbar"
              aria-label={`Progreso de ${STAGE_TITLES[stage]}`}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={done}
            >
              <div className={styles.stageBarFill} style={{ width: total ? `${(done / total) * 100}%` : 0 }} />
            </div>
            <span className="muted">
              {done} / {total}
            </span>
          </div>
          <ul className={styles.nodes}>
            {nodes
              .filter((n) => n.lesson.stage === stage)
              .map((n) => (
                <li key={n.lesson.id} className={`${styles.pathStep} ${n.status === 'completed' ? styles.pathStepDone : ''}`}>
                  <Node node={n} current={n.lesson.id === currentId} />
                </li>
              ))}
          </ul>
        </section>
      ))}
    </>
  );
}
