import { Suspense, useMemo, useState } from 'react';
import { useNow } from '../hooks/useNow';
import { Link } from 'react-router-dom';
import { useT } from '../i18n';
import { Loading } from '../components/Loading';
import { groupParam } from '../review/ReviewPage';
import { REVIEW_GROUP_IDS, reviewGroupLabel, dueCountsByGroup } from '../review/reviewLogic';
import { content } from '../domain/contentLoader';
import type { Dialogue, GameId, KanaEntry, Kanji, SentencePattern, Word } from '../domain/schema';
import { filterReadable } from '../engine';
import { kanjiWordsFor } from '../games/kanji/kanjiLogic';
import { ancestorLessons } from '../games/lessonScope';
import { GAME_REGISTRY, gameDescription, gameName } from '../games/registry';
import type { GameStats } from '../games/types';
import { accuracyOf } from '../lesson/lessonLogic';
import styles from '../lesson/lesson.module.css';
import { ExtraKanaContext } from '../state/extraKana';
import { useProgress } from '../state/progressStore';

const PRACTICE_GAMES: GameId[] = ['kana-recognize', 'kana-write', 'listen', 'read-words'];
/** Stage-2 games, practised with everything taught so far (QA-007). */
const GRAMMAR_GAMES: GameId[] = ['syntax', 'particles', 'conjugation', 'dialogues', 'mini-reading', 'numbers', 'clock', 'calendar'];
const SCRIPT_LABEL = { hiragana: 'Hiragana', katakana: 'Katakana' } as const;
const KANA_GROUPS = ['gojuon', 'dakuten', 'yoon', 'extended'] as const;
/** handakuten is practised together with dakuten. */
const groupOf = (k: KanaEntry): string => (k.group === 'handakuten' ? 'dakuten' : k.group);
const rowKey = (k: KanaEntry): string => `${k.script}:${groupOf(k)}:${k.row}`;

interface FreeSession {
  kind: 'free';
  game: GameId;
  kana: KanaEntry[];
  kanji?: Kanji[];
  words?: Word[];
  patterns?: SentencePattern[];
  dialogueIds?: string[];
  rounds?: number;
}
type Session = FreeSession | { kind: 'summary'; stats: GameStats };

const KANJI_LESSONS = [...new Set(content.kanji.map((k) => k.genkiLesson))].sort((a, b) => a - b);

export function PracticePage() {
  const t = useT();
  const items = useProgress((s) => s.items);
  const knownKana = useProgress((s) => s.knownKana);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(content.kana.filter((k) => k.script === 'hiragana' && k.group === 'gojuon').map(rowKey)),
  );
  const [game, setGame] = useState<GameId>('kana-recognize');
  const [session, setSession] = useState<Session | null>(null);
  const now = useNow();
  const unlockedKanji = useProgress((s) => s.unlockedKanji);
  const completed = useProgress((s) => s.completedLessons);
  const [grammarGame, setGrammarGame] = useState<GameId>('syntax');
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

  const counts = useMemo(() => dueCountsByGroup(items, now), [items, now]);
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

  const run = (s: FreeSession) => setSession(s);

  // Everything taught so far: completed lessons and the lessons they build on (QA-007).
  const taught = useMemo(() => {
    const done = new Set(completed);
    content.curriculum.filter((l) => done.has(l.id)).forEach((l) => ancestorLessons(l.id, content.curriculum).forEach((a) => done.add(a.id)));
    const lessons = content.curriculum.filter((l) => done.has(l.id));
    const wordIds = new Set(lessons.flatMap((l) => l.words ?? []));
    const patternIds = new Set(lessons.flatMap((l) => l.patterns ?? []));
    const dialogueIds = [...new Set(lessons.flatMap((l) => l.dialogues ?? []))];
    return {
      words: content.vocab.filter((w) => wordIds.has(w.id)),
      patterns: content.patterns.filter((p) => patternIds.has(p.id)) as SentencePattern[],
      dialogues: content.dialogues.filter((d: Dialogue) => dialogueIds.includes(d.id)).map((d) => d.id),
    };
  }, [completed]);
  const grammarMissing =
    grammarGame === 'dialogues' ? taught.dialogues.length === 0 : ['syntax', 'particles', 'mini-reading'].includes(grammarGame) ? taught.patterns.length === 0 : false;

  if (session && session.kind !== 'summary') {
    const Game = GAME_REGISTRY[session.game].component!;
    return (
      <>
        <h1>{t('practice.freeTitle')}</h1>
        <p className="muted">
          {gameName(session.game)} · {session.kanji ? t('practice.nKanji', { n: session.kanji.length }) : session.kana.length > 0 ? t('practice.nKana', { n: session.kana.length }) : t('practice.learned')}
        </p>
        <Suspense fallback={<Loading label={t('games.loading')} />}>
          {/* the selected rows count as known kana while practising (QA-016) */}
          <ExtraKanaContext.Provider value={session.kana.map((k) => k.char)}>
            <Game
              kana={session.kana}
              kanji={session.kanji}
              words={session.words ?? wordsFor(session.kana)}
              patterns={session.patterns}
              dialogueIds={session.dialogueIds}
              rounds={session.rounds}
              onFinish={(stats) => setSession({ kind: 'summary', stats })}
            />
          </ExtraKanaContext.Provider>
        </Suspense>
      </>
    );
  }

  if (session?.kind === 'summary') {
    const { stats } = session;
    return (
      <>
        <h1>{t('practice.summary')}</h1>
        <section className="card">
          <p>
            {t('games.hitsPre')}<strong>{stats.correct}</strong>{t('games.hitsOf', { total: stats.total })} ({Math.round(accuracyOf(stats) * 100)}%){t('games.bestStreak', { n: stats.bestStreak })}
          </p>
          <button type="button" className="btn btn-primary" autoFocus onClick={() => setSession(null)}>
            {t('practice.backToPractice')}
          </button>
        </section>
      </>
    );
  }

  const canStart = selectedKana.length > 0;
  return (
    <>
      <h1>{t('practice.title')}</h1>

      <section className="card" aria-labelledby="review-card">
        <h2 id="review-card">{t('practice.dueCard')}</h2>
        <p data-testid="due-summary">
          {counts.total === 0 ? t('practice.dueNone') : <>{t('practice.duePre')}<strong>{counts.total}</strong>{t('practice.duePost')}</>}
        </p>
        <div className="row">
          <Link className="btn btn-primary" to="/repaso">
            {t('practice.reviewAll', { n: counts.total })}
          </Link>
          {REVIEW_GROUP_IDS.map((g) => (
            <Link key={g} className="btn" to={`/repaso?grupo=${groupParam(g)}`} aria-disabled={counts[g] === 0}>
              {reviewGroupLabel(g)} ({counts[g]})
            </Link>
          ))}
        </div>
      </section>

      <section className="card" aria-labelledby="kanji-free">
        <h2 id="kanji-free">{t('practice.kanjiFree')}</h2>
        <p className="muted">{t('practice.kanjiRange')}</p>
        <div className="row">
          <label className="row">
            {t('practice.fromLesson')}
            <select aria-label={t('practice.fromLesson')} value={fromLesson} onChange={(e) => setFromLesson(Number(e.target.value))}>
              {KANJI_LESSONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="row">
            {t('practice.toLesson')}
            <select aria-label={t('practice.toLessonAria')} value={toLesson} onChange={(e) => setToLesson(Number(e.target.value))}>
              {KANJI_LESSONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <span className="muted">{t('practice.rangeCount', { n: rangeKanji.length })}</span>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={rangeKanji.length === 0}
          onClick={() => run({ kind: 'free', game: 'kanji', kana: [], kanji: rangeKanji, words: kanjiWords(rangeKanji) })}
        >
          {t('practice.practiceKanji')}
        </button>
        {rangeKanji.length === 0 && <span className="muted">{t('practice.needKanji')}</span>}
      </section>

      <section className="card" aria-labelledby="grammar-free">
        <h2 id="grammar-free">{t('practice.grammarFree')}</h2>
        <p className="muted">{t('practice.grammarNote')}</p>
        <div className="row">
          <label className="row">
            {t('practice.grammarGame')}
            <select value={grammarGame} onChange={(e) => setGrammarGame(e.target.value as GameId)}>
              {GRAMMAR_GAMES.map((id) => (
                <option key={id} value={id}>
                  {gameName(id)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted">{gameDescription(grammarGame)}</p>
        <button
          type="button"
          className="btn btn-primary"
          disabled={grammarMissing}
          onClick={() => run({ kind: 'free', game: grammarGame, kana: [], words: taught.words, patterns: taught.patterns, dialogueIds: taught.dialogues })}
        >
          {t('practice.practiceGrammar')}
        </button>
        {grammarMissing && <span className="muted">{t('practice.needLesson')}</span>}
      </section>

      <section className="card">
        <h2>{t('practice.kanaFree')}</h2>
        {(['hiragana', 'katakana'] as const).map((script) => (
          <fieldset key={script} className={styles.fieldset}>
            <legend>{SCRIPT_LABEL[script]}</legend>
            {KANA_GROUPS.map((group) => {
              const groupRows = [...rows.entries()].filter(([, r]) => r.script === script && r.group === group);
              if (groupRows.length === 0) return null;
              const keys = groupRows.map(([key]) => key);
              const all = keys.every((k) => selected.has(k));
              return (
                <div key={group}>
                  <label className="row">
                    <input type="checkbox" checked={all} onChange={(e) => toggle(keys, e.target.checked)} />
                    {t(`practice.group.${group}`)} ({SCRIPT_LABEL[script].toLowerCase()})
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
            {t('practice.game')}
            <select value={game} onChange={(e) => setGame(e.target.value as GameId)}>
              {PRACTICE_GAMES.map((id) => (
                <option key={id} value={id}>
                  {gameName(id)}
                </option>
              ))}
            </select>
          </label>
          <span className="muted">{t('practice.kanaSelected', { n: selectedKana.length })}</span>
        </div>
        <p className="muted">{gameDescription(game)} {t('practice.noLimit')}</p>
        <button type="button" className="btn btn-primary" disabled={!canStart} onClick={() => run({ kind: 'free', game, kana: selectedKana })}>
          {t('practice.start')}
        </button>
        {!canStart && <span className="muted">{t('practice.pickRow')}</span>}
      </section>
    </>
  );
}
