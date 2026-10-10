import { useMemo } from 'react';
import { JaText } from '../components/JaText';
import { SpeakButton } from '../components/SpeakButton';
import { content } from '../domain/contentLoader';
import type { Kanji, Word } from '../domain/schema';
import { kanjiWordsFor, meaningText } from '../games/kanji/kanjiLogic';
import { useProgress } from '../state/progressStore';
import styles from './lesson.module.css';

/** 2-4 example words of a kanji from the learner's vocabulary, preferring words whose kanji are all known. */
export function exampleWords(k: Kanji, allowed: ReadonlySet<string>, vocab: readonly Word[] = content.vocab): Word[] {
  const byId = new Map(vocab.map((w) => [w.id, w]));
  const own = k.words.flatMap((id) => byId.get(id) ?? []);
  const known = kanjiWordsFor(own, allowed);
  return (known.length >= 2 ? known : own).slice(0, 4);
}

function Readings({ kanji }: { kanji: Kanji }) {
  const teach = new Set(kanji.teach ?? []);
  const show = (readings: string[]) =>
    readings.map((r, i) => (
      <span key={r}>
        {i > 0 && ', '}
        {teach.has(r) ? <strong className={styles.taught}>{r}</strong> : <span className="muted">{r}</span>}
      </span>
    ));
  return (
    <dl className={styles.readings}>
      {kanji.on.length > 0 && (
        <>
          <dt>on</dt>
          <dd lang="ja">{show(kanji.on)}</dd>
        </>
      )}
      {kanji.kun.length > 0 && (
        <>
          <dt>kun</dt>
          <dd lang="ja">{show(kanji.kun)}</dd>
        </>
      )}
    </dl>
  );
}

/** Intro of a kanji lesson: every new kanji big, with its meaning, readings (Genki's highlighted), strokes and example words. */
export function KanjiIntro({ kanji, onStart }: { kanji: readonly Kanji[]; onStart: () => void }) {
  const unlocked = useProgress((s) => s.unlockedKanji);
  const showRomaji = useProgress((s) => s.settings.showRomaji);
  const allowed = useMemo(() => new Set([...unlocked, ...kanji.map((k) => k.char)]), [unlocked, kanji]);
  return (
    <section className="card">
      <h2>Kanji nuevos</h2>
      <p className="muted">
        En negrita, las lecturas que enseña Genki. Al completar la lección estos kanji se desbloquean y aparecen con furigana en todas partes; el
        furigana desaparece cuando llegas a Guru con cada uno.
      </p>
      <ul className={styles.kanjiGrid}>
        {kanji.map((k) => (
          <li key={k.char} className={styles.kanjiCard} data-testid={`kanji-card-${k.char}`}>
            <div className={styles.bigKanji} lang="ja">
              {k.char}
            </div>
            <div className={styles.romaji}>{meaningText(k)}</div>
            <Readings kanji={k} />
            {k.strokes !== undefined && <div className="muted">{k.strokes} trazos</div>}
            <ul className={styles.examples}>
              {exampleWords(k, allowed).map((w) => (
                <li key={w.id}>
                  <JaText word={w} /> <span lang="ja">({w.kana})</span> <span className="muted">{w.es[0]}</span>
                  {showRomaji && <span className="muted"> · {w.romaji}</span>}{' '}
                  <SpeakButton text={w.kana} label="Oír" />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        <button type="button" className="btn btn-primary" autoFocus onClick={onStart}>
          Empezar práctica
        </button>
      </div>
    </section>
  );
}
