import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon, type IconName } from "../components/Icon";
import { content } from "../domain/contentLoader";
import { lessonTitle } from "../domain/glosses";
import type { Lesson } from "../domain/schema";
import { useLang, useT } from "../i18n";
import {
  computePathNodes,
  nextLesson,
  shortTitle,
  unmetRequirements,
  type LessonNode,
} from "../lesson/lessonLogic";
import styles from "../lesson/lesson.module.css";
import { useProgress } from "../state/progressStore";

type Stage = Lesson["stage"];

/** Stage numerals shown on the stage header (一 … 五). */
const NUMERALS: Record<Stage, string> = {
  1: "一",
  2: "二",
  3: "三",
  4: "四",
  5: "五",
};

const COLLAPSED_KEY = "nihongo-dojo:path-collapsed";

/** Manual fold state per stage (`true` = folded). Missing entries mean "use the default" (folded when 100 % done). */
function readCollapsed(): Partial<Record<Stage, boolean>> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object"
      ? (parsed as Partial<Record<Stage, boolean>>)
      : {};
  } catch {
    return {};
  }
}

function writeCollapsed(value: Partial<Record<Stage, boolean>>): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(value));
  } catch {
    /* storage blocked: folding still works for this visit */
  }
}

function Node({
  node,
  current,
  unmet,
}: {
  node: LessonNode;
  current: boolean;
  unmet: string[];
}) {
  const t = useT();
  const lang = useLang();
  const { lesson, status, playable, comingSoon } = node;
  const icon: IconName =
    status === "completed"
      ? "check"
      : status === "locked"
        ? "lock"
        : comingSoon
          ? "clock"
          : "play";
  const label =
    status === "completed"
      ? t("path.completed")
      : status === "locked"
        ? t("path.locked")
        : comingSoon
          ? t("path.soon")
          : t("path.available");
  const body = (
    <>
      <span className={styles.nodeIcon} aria-hidden="true">
        <Icon name={icon} size={18} strokeWidth={2.5} />
      </span>
      <span className={styles.nodeBody}>
        <strong>{lessonTitle(lesson, lang)}</strong>
        <span className={styles.nodeState}>
          {current ? t("path.current") : label}
        </span>
        {status === "locked" && unmet.length > 0 && (
          <span className={styles.nodeState}>
            {t("path.requires", { list: unmet.join(", ") })}
          </span>
        )}
      </span>
      {status !== "locked" && playable && (
        <Icon name="chevron-right" size={18} className={styles.nodeGo} />
      )}
    </>
  );
  const cls = [
    styles.node,
    status === "locked" ? styles.nodeLocked : "",
    status === "completed" ? styles.nodeDone : "",
    current ? styles.nodeCurrent : "",
  ]
    .filter(Boolean)
    .join(" ");
  if (status !== "locked" && playable) {
    return (
      <Link
        to={`/leccion/${lesson.id}`}
        className={cls}
        aria-current={current ? "step" : undefined}
      >
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

/** Stages that have lessons, with their progress (stage 5 shows up only when the curriculum has it). */
function stagesOf(
  curriculum: readonly Lesson[],
  completed: ReadonlySet<string>,
) {
  const stages = [...new Set(curriculum.map((l) => l.stage))].sort(
    (a, b) => a - b,
  );
  return stages.map((stage) => {
    const lessons = curriculum.filter((l) => l.stage === stage);
    return {
      stage,
      total: lessons.length,
      done: lessons.filter((l) => completed.has(l.id)).length,
    };
  });
}

/** Scrolls the lesson `id` into view (after the render that unfolded its stage) and focuses its link. */
function JumpTo({ id, onDone }: { id: string | undefined; onDone: () => void }) {
  useEffect(() => {
    if (!id) return;
    const el = document.getElementById(`lesson-${id}`);
    if (el) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView?.({ behavior: reduce ? "auto" : "smooth", block: "center" });
      el.querySelector<HTMLElement>("a, button")?.focus({ preventScroll: true });
    }
    onDone();
  }, [id, onDone]);
  return null;
}

export function PathPage() {
  const t = useT();
  const lang = useLang();
  const [jump, setJump] = useState(false);
  const completed = useProgress((s) => s.completedLessons);
  const [manual, setManual] = useState(readCollapsed);
  const { curriculum } = content;
  const completedSet = new Set(completed);
  const nodes = computePathNodes(curriculum, completed);
  const currentId = nextLesson(nodes, completed)?.id;

  if (curriculum.length === 0) {
    return (
      <>
        <h1>{t("path.title")}</h1>
        <p className="muted">{t("path.empty")}</p>
      </>
    );
  }

  const currentStage = curriculum.find((l) => l.id === currentId)?.stage;
  // «Ir a la lección actual»: unfold its stage if needed, then scroll to it once it is rendered (QA-110).
  const goToCurrent = () => {
    if (currentStage !== undefined && manual[currentStage]) {
      const next = { ...manual, [currentStage]: false };
      setManual(next);
      writeCollapsed(next);
    }
    setJump(true);
  };

  const toggle = (stage: Stage, folded: boolean) => {
    const next = { ...manual, [stage]: !folded };
    setManual(next);
    writeCollapsed(next);
  };

  return (
    <>
      <h1>{t("path.title")}</h1>
      {currentId && (
        <p>
          <button type="button" className="btn" onClick={goToCurrent} data-testid="path-jump">
            <Icon name="chevron-down" size={18} /> {t("path.jump")}
          </button>
        </p>
      )}
      <JumpTo id={jump ? currentId : undefined} onDone={() => setJump(false)} />
      {stagesOf(curriculum, completedSet).map(({ stage, total, done }) => {
        const title = t(`stage.${stage}`);
        const folded = manual[stage] ?? (total > 0 && done === total);
        return (
          <section
            key={stage}
            className={styles.stage}
            data-stage={stage}
            aria-labelledby={`stage-${stage}`}
          >
            <div className={styles.stageHead}>
              <span className={styles.numeral} lang="ja" aria-hidden="true">
                {NUMERALS[stage]}
              </span>
              <div className={styles.stageTitle}>
                <h2 id={`stage-${stage}`}>
                  {stage}. {title}
                </h2>
                <span className={styles.stageCount}>
                  {done} / {total}
                </span>
              </div>
              <button
                type="button"
                className={styles.fold}
                aria-expanded={!folded}
                aria-controls={`stage-nodes-${stage}`}
                aria-label={
                  folded
                    ? t("path.expand", { stage: title })
                    : t("path.collapse", { stage: title })
                }
                onClick={() => toggle(stage, folded)}
              >
                <Icon
                  name="chevron-down"
                  size={20}
                  className={
                    folded
                      ? styles.foldIcon
                      : `${styles.foldIcon} ${styles.foldOpen}`
                  }
                />
              </button>
              <div
                className={styles.stageBar}
                role="progressbar"
                aria-label={t("path.stageProgress", { stage: title })}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={done}
              >
                <div
                  className={styles.stageBarFill}
                  style={{ width: total ? `${(done / total) * 100}%` : 0 }}
                />
              </div>
            </div>
            {!folded && (
              <ul className={styles.nodes} id={`stage-nodes-${stage}`}>
                {nodes
                  .filter((n) => n.lesson.stage === stage)
                  .map((n) => (
                    <li
                      key={n.lesson.id}
                      id={`lesson-${n.lesson.id}`}
                      className={`${styles.pathStep} ${n.status === "completed" ? styles.pathStepDone : ""}`}
                    >
                      <Node
                        node={n}
                        current={n.lesson.id === currentId}
                        unmet={
                          n.status === "locked"
                            ? unmetRequirements(
                                n.lesson,
                                completedSet,
                                curriculum,
                              ).map((l) => shortTitle(l, lang))
                            : []
                        }
                      />
                    </li>
                  ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}
