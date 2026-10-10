import { useMemo, useState } from 'react';
import { content } from '../domain/contentLoader';
import type { GameId, KanaEntry, Kanji, Word } from '../domain/schema';
import { dueItems, filterReadable, reviewQueue } from '../engine';
import { kanjiWordsFor } from '../games/kanji/kanjiLogic';
import { GAME_REGISTRY } from '../games/registry';
import type { GameStats } from '../games/types';
import { accuracyOf } from '../lesson/lessonLogic';
import styles from '../lesson/lesson.module.css';
import { useProgress } from '../state/progressStore';

const PRACTICE_GAMES: GameId[] = ['kana-recognize', 'kana-write', 'listen', 'read-words'];
const SCRIPT_LABEL = { hiragana: 'Hiragana', katakana: 'Katakana' } as const;
const GROUP_LABEL: Record<string, string> = {
  gojuon: 'Básicos',
  dakuten: 'Dakuten y handakuten',
  yoon: 'Yōon',
  extended: 'Especiales',
};
/** handakuten is practised together with dakuten. */
const groupOf = (k: KanaEntry): string => (k.group === 'handakuten' ? 'dakuten' : k.group);
const rowKey = (k: KanaEntry): string => `${k.script}:${groupOf(k)}:${k.row}`;

type Session =
  | { kind: 'free' | 'review'; game: GameId; kana: KanaEntry[]; rounds?: number; kanji?: undefined; words?: undefined }
  | { kind: 'free' | 'review'; game: 'kanji'; kana: []; kanji: Kanji[]; words: Word[]; rounds?: number }
  | { kind: 'summary'; stats: GameStats };

/** Progress item of a word asked in the kanji game: `word:<id>:kanji`. */
const KANJI_WORD_SUFFIX = ':kanji';
const REVIEW_LIMIT = 20;
const KANJI_LESSONS = [...new Set(content.kanji.map((k) => k.genkiLesson))].sort((a, b) => a - b);

/** Due kanji and kanji-words (SRS review queue), turned into the content the kanji game walks through. */
export function kanjiReview(items: Parameters<typeof reviewQueue>[0], now: number, limit = REVIEW_LIMIT): { kanji: Kanji[]; words: Word[] } {
  const own = Object.values(items).filter((i) => i.kind === 'kanji' || (i.kind === 'word' && i.itemId.endsWith(KANJI_WORD_SUFFIX)));
  const queue = reviewQueue(own, now, { limit });
  const kanji = queue.filter((i) => i.kind === 'kanji').flatMap((i) => content.kanji.find((k) => k.char === i.itemId) ?? []);
  const words = queue
    .filter((i) => i.kind === 'word')
    .flatMap((i) => content.vocab.find((w) => w.id === i.itemId.slice(0, -KANJI_WORD_SUFFIX.length)) ?? []);
  return { kanji, words };
}

export function PracticePage() {
  const items = useProgress((s) => s.items);
  const knownKana = useProgress((s) => s.knownKana);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(content.kana.filter((k) => k.script === 'hiragana' && k.group === 'gojuon').map(rowKey)),
  );
  const [game, setGame] = useState<GameId>('kana-recognize');
  const [session, setSession] = useState<Session | null>(null);
  const [now] = useState(() => Date.now());
  const unlockedKanji = useProgress((s) => s.unlockedKanji);
  const [fromLesson, setFromLesson] = useState(KANJI_LESSONS[0] ?? 3);
  const [toLesson, setToLesson] = useState(KANJI_LESSONS.at(-1) ?? 12);

  const rows = useMemo(() => {
    const map = new Map<string, { script: KanaEntry['script']; group: string; kana: KanaEntry[] }>();
    for (const k of content.kana) {
      const key = rowKey(k);
      const row = map.get(key) ?? { script: k.script, group: groupOf(k), kana: [] };
      row.kana.push(k);
      map.set(key, row);
    }
    return map;
  }, []);

  const due = useMemo(() => {
    const kanaItems = Object.values(items).filter((i) => i.kind === 'kana');
    return dueItems(kanaItems, now);
  }, [items, now]);
  const dueKana = due.map((i) => content.kana.find((k) => k.char === i.itemId)).filter((k): k is KanaEntry => k !== undefined);

  const kanjiDue = useMemo(() => kanjiReview(items, now), [items, now]);
  const kanjiDueCount = kanjiDue.kanji.length + kanjiDue.words.length;
  const unlockedSet = useMemo(() => new Set(unlockedKanji), [unlockedKanji]);
  const rangeKanji = content.kanji.filter((k) => unlockedSet.has(k.char) && k.genkiLesson >= fromLesson && k.genkiLesson <= toLesson);
  const kanjiWords = (list: Kanji[]) => kanjiWordsFor(content.vocab, new Set([...unlockedSet, ...list.map((k) => k.char)]));

  const toggle = (keys: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
      return next;
    });

  const selectedKana = content.kana.filter((k) => selected.has(rowKey(k)));
  const wordsFor = (kana: KanaEntry[]) =>
    filterReadable(content.vocab, new Set([...knownKana, ...kana.map((k) => k.char)]));

  const run = (s: Exclude<Session, { kind: 'summary' }>) => setSession(s);

  if (session && session.kind !== 'summary') {
    const Game = GAME_REGISTRY[session.game].component!;
    return (
      <>
        <h1>{session.kind === 'review' ? 'Repasos pendientes' : 'Práctica libre'}</h1>
        <p className="muted">
          {GAME_REGISTRY[session.game].name} · {session.kanji ? `${session.kanji.length} kanji` : `${session.kana.length} kana`}
        </p>
        <Game
          kana={session.kana}
          kanji={session.kanji}
          words={session.words ?? wordsFor(session.kana)}
          rounds={session.rounds}
          sequential={session.kind === 'review'}
          onFinish={(stats) => setSession({ kind: 'summary', stats })}
        />
      </>
    );
  }

  if (session?.kind === 'summary') {
    const { stats } = session;
    return (
      <>
        <h1>Resumen</h1>
        <section className="card">
          <p>
            Aciertos: <strong>{stats.correct}</strong> de {stats.total} ({Math.round(accuracyOf(stats) * 100)}%) · Mejor racha: {stats.bestStreak}
          </p>
          <button type="button" className="btn btn-primary" autoFocus onClick={() => setSession(null)}>
            Volver a la práctica
          </button>
        </section>
      </>
    );
  }

  const canStart = selectedKana.length > 0;
  return (
    <>
      <h1>Práctica</h1>

      <section className="card">
        <h2>Repasos pendientes</h2>
        <p>
          {due.length === 0 ? 'No tienes repasos pendientes ahora mismo.' : <>Tienes <strong>{due.length}</strong> kana por repasar.</>}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          disabled={dueKana.length === 0}
          onClick={() => run({ kind: 'review', game: 'kana-recognize', kana: dueKana.slice(0, 20), rounds: Math.min(dueKana.length, 20) })}
        >
          Repasar ({due.length})
        </button>
      </section>

      <section className="card" aria-labelledby="kanji-review">
        <h2 id="kanji-review">Repaso de kanji</h2>
        <p>
          {kanjiDueCount === 0 ? 'No tienes kanji por repasar ahora mismo.' : <>Tienes <strong>{kanjiDueCount}</strong> kanji y palabras con kanji por repasar.</>}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          disabled={kanjiDueCount === 0}
          onClick={() => run({ kind: 'review', game: 'kanji', kana: [], kanji: kanjiDue.kanji, words: kanjiDue.words, rounds: kanjiDueCount })}
        >
          Repasar kanji ({kanjiDueCount})
        </button>
      </section>

      <section className="card" aria-labelledby="kanji-free">
        <h2 id="kanji-free">Práctica libre de kanji</h2>
        <p className="muted">Elige un rango de lecciones de Genki; solo se practican los kanji ya desbloqueados.</p>
        <div className="row">
          <label className="row">
            Desde la lección
            <select aria-label="Desde la lección" value={fromLesson} onChange={(e) => setFromLesson(Number(e.target.value))}>
              {KANJI_LESSONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="row">
            hasta la
            <select aria-label="Hasta la lección" value={toLesson} onChange={(e) => setToLesson(Number(e.target.value))}>
              {KANJI_LESSONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <span className="muted">{rangeKanji.length} kanji desbloqueados en el rango</span>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={rangeKanji.length === 0}
          onClick={() => run({ kind: 'free', game: 'kanji', kana: [], kanji: rangeKanji, words: kanjiWords(rangeKanji) })}
        >
          Practicar kanji
        </button>
        {rangeKanji.length === 0 && <span className="muted"> Completa una lección de kanji para desbloquearlos.</span>}
      </section>

      <section className="card">
        <h2>Práctica libre</h2>
        {(['hiragana', 'katakana'] as const).map((script) => (
          <fieldset key={script} className={styles.fieldset}>
            <legend>{SCRIPT_LABEL[script]}</legend>
            {Object.keys(GROUP_LABEL).map((group) => {
              const groupRows = [...rows.entries()].filter(([, r]) => r.script === script && r.group === group);
              if (groupRows.length === 0) return null;
              const keys = groupRows.map(([key]) => key);
              const all = keys.every((k) => selected.has(k));
              return (
                <div key={group}>
                  <label className="row">
                    <input type="checkbox" checked={all} onChange={(e) => toggle(keys, e.target.checked)} />
                    {GROUP_LABEL[group]} ({SCRIPT_LABEL[script].toLowerCase()})
                  </label>
                  <div className={styles.chips}>
                    {groupRows.map(([key, r]) => {
                      const on = selected.has(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={on}
                          className={`${styles.chip} ${on ? styles.chipOn : ''}`}
                          title={r.kana.map((k) => k.romaji).join(' ')}
                          onClick={() => toggle([key], !on)}
                        >
                          {r.kana[0]!.char}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </fieldset>
        ))}
        <div className="row">
          <label className="row">
            Juego:
            <select value={game} onChange={(e) => setGame(e.target.value as GameId)}>
              {PRACTICE_GAMES.map((id) => (
                <option key={id} value={id}>
                  {GAME_REGISTRY[id].name}
                </option>
              ))}
            </select>
          </label>
          <span className="muted">{selectedKana.length} kana seleccionados</span>
        </div>
        <p className="muted">{GAME_REGISTRY[game].description} Sin límite de rondas: pulsa «Terminar» cuando quieras.</p>
        <button type="button" className="btn btn-primary" disabled={!canStart} onClick={() => run({ kind: 'free', game, kana: selectedKana })}>
          Empezar
        </button>
        {!canStart && <span className="muted"> Elige al menos una fila.</span>}
      </section>
    </>
  );
}
