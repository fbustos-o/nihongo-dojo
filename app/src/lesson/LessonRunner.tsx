import { Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { JaText } from '../components/JaText';
import { SpeakButton } from '../components/SpeakButton';
import { content } from '../domain/contentLoader';
import type { Lesson } from '../domain/schema';
import { CONFUSABLE_GROUPS } from '../games/confusables';
import { kanaHint, romajiLabel } from '../games/kanaUtils';
import { gameHasMaterial } from '../games/lessonScope';
import { getGame, preloadGame } from '../games/registry';
import { Loading } from '../components/Loading';
import { kanjiRounds, mergeStats, accuracyOf, computePathNodes, finishLesson, lessonContent, nextLesson, playableGames, roundsFor, sampleWords, weakestItems, xpEarned, PASS_ACCURACY } from './lessonLogic';
import type { GameStats } from '../games/types';
import { ExtraKanaContext, ExtraKanjiContext } from '../state/extraKana';
import { KanjiIntro } from './KanjiIntro';
import { useProgress } from '../state/progressStore';
import { KanaChart } from './KanaChart';
import styles from './lesson.module.css';

type Phase = 'intro' | 'practice' | 'result';
const PHASES: { id: Phase; label: string }[] = [
  { id: 'intro', label: '1 · Introducción' },
  { id: 'practice', label: '2 · Práctica' },
  { id: 'result', label: '3 · Resultado' },
];

/** Page at /leccion/:id. */
export function LessonRunner() {
  const { id } = useParams();
  const lesson = content.curriculum.find((l) => l.id === id);
  const completed = useProgress((s) => s.completedLessons);
  if (!lesson) {
    return (
      <>
        <h1>Lección no encontrada</h1>
        <Link to="/camino">Volver al camino</Link>
      </>
    );
  }
  const node = computePathNodes(content.curriculum, completed).find((n) => n.lesson.id === lesson.id)!;
  if (node.status === 'locked') {
    return (
      <>
        <h1>{lesson.title}</h1>
        <p className="card">Esta lección está bloqueada: completa antes las lecciones anteriores.</p>
        <Link to="/camino">Volver al camino</Link>
      </>
    );
  }
  if (!node.playable) {
    return (
      <>
        <h1>{lesson.title}</h1>
        <p className="card">Próximamente: los juegos de esta lección todavía no están disponibles.</p>
        <Link to="/camino">Volver al camino</Link>
      </>
    );
  }
  // key: restarting a lesson remounts the run
  return <LessonRun key={lesson.id} lesson={lesson} />;
}

function LessonRun({ lesson }: { lesson: Lesson }) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [gameIndex, setGameIndex] = useState(0);
  const [results, setResults] = useState<GameStats[]>([]);
  const [outcome, setOutcome] = useState<{ passed: boolean; accuracy: number } | null>(null);
  const [run, setRun] = useState(0);
  const knownKana = useProgress((s) => s.knownKana);

  // Snapshot of the lesson's material, fixed for the whole run so unlocking at the end does not reshuffle it.
  const [data] = useState(() => {
    const full = lessonContent(lesson, new Set(useProgress.getState().knownKana), content);
    // loanword lessons gather 22-40 words: a weighted sample is practised per run
    return lesson.stage === 3 ? { ...full, words: sampleWords(full.words) } : full;
  });
  const lessonPatterns = useMemo(() => content.patterns.filter((p) => lesson.patterns?.includes(p.id)), [lesson]);
  const games = useMemo(
    () =>
      playableGames(lesson).filter((id) => {
        if (id === 'kanji') return data.kanji.length > 0;
        // syntax / mini-reading / dialogues without any (own or inherited) material are skipped
        if (!gameHasMaterial(id, lesson, content)) return false;
        const needsKana = id === 'kana-recognize' || id === 'kana-write';
        return needsKana ? data.kana.length > 0 : data.words.length > 0 || data.kana.length > 0;
      }),
    [lesson, data],
  );

  const restart = () => {
    setPhase('intro');
    setGameIndex(0);
    setResults([]);
    setOutcome(null);
    setRun((r) => r + 1);
  };

  const onGameFinish = (stats: GameStats) => {
    const all = [...results, stats];
    setResults(all);
    if (gameIndex + 1 < games.length) {
      setGameIndex(gameIndex + 1);
    } else {
      setOutcome(finishLesson(lesson, mergeStats(all)));
      setPhase('result');
    }
  };

  // warm up the game chunks while the learner reads the intro
  useEffect(() => {
    games.forEach(preloadGame);
  }, [games]);

  const gameId = games[gameIndex];
  const game = gameId ? getGame(gameId) : undefined;
  const Game = game?.component;
  const total = mergeStats(results);

  return (
    <ExtraKanaContext.Provider value={data.newKana}>
      <ExtraKanjiContext.Provider value={data.newKanji}>
        <div className={styles.header}>
          <h1>{lesson.title}</h1>
          <Link to="/camino">Salir</Link>
        </div>
        <ol className={styles.steps} aria-label="Fases de la lección">
          {PHASES.map((p) => (
            <li key={p.id} className={`${styles.step} ${p.id === phase ? styles.stepActive : ''}`} aria-current={p.id === phase ? 'step' : undefined}>
              {p.label}
            </li>
          ))}
        </ol>

        {phase === 'intro' && (
          <Intro lesson={lesson} data={data} known={new Set(knownKana)} onStart={() => setPhase('practice')} />
        )}

        {phase === 'practice' && Game && game && (
          <>
            <p className="muted">
              Juego {gameIndex + 1} de {games.length}: <strong>{game.name}</strong> — {game.description}
            </p>
            <Suspense fallback={<Loading label="Cargando juego…" />}>
            <Game
              key={`${run}-${gameId}`}
              kana={data.kana}
              kanji={data.kanji}
              newKanji={data.newKanji}
              words={data.words}
              newKana={data.newKana}
              dialogueIds={lesson.dialogues}
              lessonId={lesson.id}
              patterns={lessonPatterns}
              rounds={gameId === 'kanji' ? kanjiRounds(data.kanji.length) : roundsFor(gameId === 'kana-recognize' || gameId === 'kana-write' ? data.kana.length : data.words.length)}
              onFinish={onGameFinish}
            />
            </Suspense>
          </>
        )}

        {phase === 'result' && outcome && (
          <Result lesson={lesson} stats={total} passed={outcome.passed} onRetry={restart} />
        )}
      </ExtraKanjiContext.Provider>
    </ExtraKanaContext.Provider>
  );
}

function Intro({ lesson, data, known, onStart }: { lesson: Lesson; data: ReturnType<typeof lessonContent>; known: ReadonlySet<string>; onStart: () => void }) {
  const showRomaji = useProgress((s) => s.settings.showRomaji);
  if (data.kanji.length > 0) return <KanjiIntro kanji={data.kanji} onStart={onStart} />;
  // Katakana look-alike groups that include a kana of this lesson (シ/ツ, ソ/ン...); same-script only.
  const isNewKana = (c: string) => data.newKana.includes(c);
  const lookAlikes = lesson.stage === 3 ? CONFUSABLE_GROUPS.filter((g) => /[ァ-ヺ]/.test(g[0]!) && /[ァ-ヺ]/.test(g[1]!) && g.some(isNewKana)) : [];
  return (
    <section className="card">
      {data.kana.length > 0 ? (
        <>
          <h2>Kana nuevos</h2>
          <ul className={styles.introGrid}>
            {data.kana.map((k) => (
              <li key={k.char} className={styles.introCard}>
                <div className={styles.bigKana} lang="ja">
                  {k.char}
                </div>
                <div className={styles.romaji}>{romajiLabel(k)}</div>
                {kanaHint(k) && <div className="muted">{kanaHint(k)}</div>}
                <SpeakButton text={k.char} label="Oír" />
              </li>
            ))}
          </ul>
          {lookAlikes.length > 0 && (
            <p className="muted" data-testid="look-alikes">
              Cuidado con las parecidas: <span lang="ja">{lookAlikes.map((g) => g.join(' / ')).join(' · ')}</span>
            </p>
          )}
          <h2>Dónde están en la tabla</h2>
          <KanaChart highlight={lesson.kana ?? []} known={known} />
        </>
      ) : (
        <>
          <h2>Palabras de la lección</h2>
          <ul className={styles.weak}>
            {data.words.slice(0, 24).map((w) => (
              <li key={w.id}>
                <JaText word={w} /> <span className="muted">{w.es[0]}</span>
                {showRomaji && <span className="muted"> · {w.romaji}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className={styles.actions}>
        <button type="button" className="btn btn-primary" autoFocus onClick={onStart}>
          Empezar práctica
        </button>
      </div>
    </section>
  );
}

function Result({ lesson, stats, passed, onRetry }: { lesson: Lesson; stats: GameStats; passed: boolean; onRetry: () => void }) {
  const completed = useProgress((s) => s.completedLessons);
  const next = nextLesson(computePathNodes(content.curriculum, completed));
  const weak = weakestItems(stats);
  const accuracy = Math.round(accuracyOf(stats) * 100);
  return (
    <section className="card" aria-labelledby="result-title">
      <h2 id="result-title">{passed ? '¡Lección completada!' : 'Casi lo logras'}</h2>
      <p className={`${styles.score} ${passed ? styles.pass : styles.fail}`}>
        <span aria-hidden="true">{passed ? '✓' : '✗'}</span> {accuracy}%
      </p>
      <p>
        Aciertos: {stats.correct} de {stats.total} · XP ganado: <strong>+{xpEarned(stats)}</strong> · Mejor racha: {stats.bestStreak}
      </p>
      {!passed && <p className="muted">Necesitas al menos {Math.round(PASS_ACCURACY * 100)}% de aciertos para completarla.</p>}
      {passed && (lesson.kanji?.length ?? 0) > 0 && (
        <p>
          Kanji desbloqueados: <span lang="ja">{lesson.kanji!.join(' ')}</span>. Ahora aparecen con furigana en todo el contenido; el furigana
          desaparece cuando dominas cada kanji (Guru).
        </p>
      )}
      {passed && (lesson.kana?.length ?? 0) > 0 && <p>Kana desbloqueados: <span lang="ja">{lesson.kana!.join(' ')}</span></p>}
      {weak.length > 0 && (
        <>
          <h3>Para repasar</h3>
          <ul className={styles.weak}>
            {weak.map((w) => (
              <li key={w.key}>
                {w.label} <span className="muted">× {w.wrong}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className={styles.actions}>
        <button type="button" className="btn" onClick={onRetry}>
          Repetir lección
        </button>
        {passed && next && (
          <Link className="btn btn-primary" to={`/leccion/${next.id}`} style={{ textDecoration: 'none' }}>
            Continuar: {next.title}
          </Link>
        )}
        <Link className="btn" to="/camino" style={{ textDecoration: 'none' }}>
          Volver al camino
        </Link>
      </div>
    </section>
  );
}
