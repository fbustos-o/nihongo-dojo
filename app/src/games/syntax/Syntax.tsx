import { useMemo, useRef, useState } from 'react';
import { JaText } from '../../components/JaText';
import { SpeakButton } from '../../components/SpeakButton';
import { content } from '../../domain/contentLoader';
import { exampleTranslation } from '../../domain/glosses';
import { useSpeech } from '../../hooks/useSpeech';
import { useMeaningLang, useT } from '../../i18n';
import { useProgress } from '../../state/progressStore';
import { Feedback, GameFrame, useGameSession, useQuestionPicker, type FeedbackMessage } from '../shared';
import { playSfx } from '../shared/sfx';
import { scopedPatterns } from '../lessonScope';
import shared from '../shared/games.module.css';
import type { GameProps } from '../types';
import styles from './syntax.module.css';
import { buildSolutionTable, buildTiles, isValidOrder, syntaxEntries, type Entry, type Tile } from './syntaxLogic';

interface Question {
  entry: Entry;
  tiles: Tile[];
}

const Word = ({ text }: { text: string }) => <JaText word={{ kana: text }} />;

/**
 * The teacher's syntax sheet as a game: Spanish S-V-O sentence -> build the Japanese S-O-V sentence
 * with tiles (words + particles, plus distractor particles). Tap a tile to place it, tap it again
 * (in the answer) to take it back. Everything is a button, so Tab / Enter work too.
 */
export function Syntax({ patterns, rounds, sequential, onlyItems, lessonId, onFinish }: GameProps) {
  const t = useT();
  const meaningLang = useMeaningLang();
  const session = useGameSession({ rounds, onFinish });
  const showRomaji = useProgress((s) => s.settings.showRomaji);
  const { speak } = useSpeech();
  const pool = useMemo(() => {
    const all = syntaxEntries(scopedPatterns(patterns, lessonId, content.curriculum, content.patterns));
    const only = onlyItems ? all.filter((e) => onlyItems.includes(e.id)) : all;
    return only.length > 0 ? only : all;
  }, [patterns, onlyItems, lessonId]);
  const pick = useQuestionPicker('pattern', sequential);
  const counter = useRef(0);

  const make = (): Question => {
    const entry = pick(pool);
    return { entry, tiles: buildTiles(entry.tokens) };
  };

  const [question, setQuestion] = useState<Question | null>(() => (pool.length ? make() : null));
  const [placed, setPlaced] = useState<string[]>([]);
  const [result, setResult] = useState<{ correct: boolean } | null>(null);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  if (!question) return <p className="muted">{t('games.noSyntax')}</p>;

  const { entry, tiles } = question;
  const byId = new Map(tiles.map((tile) => [tile.id, tile]));
  const answerTokens = placed.map((id) => byId.get(id)!.text);

  const check = () => {
    if (placed.length === 0 || result) return;
    const correct = isValidOrder(entry.tokens, answerTokens);
    session.report(entry.id, 'pattern', entry.example.ja.replace(/\s+/gu, ''), correct);
    playSfx(correct ? 'ok' : 'bad');
    setResult({ correct });
    setMessage({ tone: correct ? 'ok' : 'bad', text: correct ? t('games.syntaxOk') : t('games.syntaxBad'), id: ++counter.current });
    speak(entry.example.ja.replace(/\s+/gu, ''));
  };

  const next = () => {
    session.next();
    setQuestion(make());
    setPlaced([]);
    setResult(null);
    setMessage(null);
  };

  const table = buildSolutionTable(entry.pattern, entry.fullTokens);

  return (
    <GameFrame session={session}>
      <div className={shared.round}>
        <p className={styles.sentence} data-testid="prompt">
          {exampleTranslation(entry.example, meaningLang)}
        </p>
        {table.spanish.length > 0 && (
          <div className={styles.structure} aria-label={t(meaningLang === 'en' ? 'games.structureEn' : 'games.structureEs')}>
            {table.spanish.map((slot, i) => (
              <span key={i} className={styles.slot}>
                {slot.label}
              </span>
            ))}
            <span aria-hidden="true">{t('games.verbLast')}</span>
          </div>
        )}
        {message && <Feedback message={message} />}

        <div className={styles.area} aria-label={t('games.yourSentence')}>
          {placed.length === 0 && <p className={styles.areaEmpty}>{t('games.tapTiles')}</p>}
          {placed.map((id, i) => (
            <button key={id} type="button" className={`${styles.tile} ${byId.get(id)!.particle ? styles.particleTile : ''}`} disabled={result !== null} title={t('games.remove')} onClick={() => setPlaced(placed.filter((_, j) => j !== i))} data-testid={`placed-${i}`}>
              <Word text={byId.get(id)!.text} />
            </button>
          ))}
        </div>

        {!result && (
          <div className={styles.bank} role="group" aria-label={t('games.tilesAvailable')}>
            {tiles.map((tile) => (
              <button key={tile.id} type="button" className={`${styles.tile} ${tile.particle ? styles.particleTile : ''} ${placed.includes(tile.id) ? styles.used : ''}`} disabled={placed.includes(tile.id)} aria-hidden={placed.includes(tile.id) || undefined} onClick={() => setPlaced([...placed, tile.id])}>
                <Word text={tile.text} />
              </button>
            ))}
          </div>
        )}

        {!result && (
          <div className={`${styles.actions} ${styles.stickyActions}`}>
            <button type="button" className="btn" disabled={placed.length === 0} onClick={() => setPlaced([])}>
              {t('games.clear')}
            </button>
            <button type="button" className="btn btn-primary" disabled={placed.length === 0} onClick={check}>
              {t('common.check')}
            </button>
          </div>
        )}

        {result && (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table} data-testid="solution-table">
                <caption className="muted">{t(meaningLang === 'en' ? 'games.syntaxCaptionEn' : 'games.syntaxCaptionEs')}</caption>
                <tbody>
                  {table.spanish.length > 0 && (
                    <tr>
                      <th scope="row">{t(meaningLang === 'en' ? 'games.structureEnRow' : 'games.structureEsRow')}</th>
                      {table.spanish.map((cell, i) => (
                        <td key={i} className={cell.predicate ? styles.verb : undefined}>
                          {cell.label}
                        </td>
                      ))}
                    </tr>
                  )}
                  <tr>
                    <th scope="row">{t('games.structureJa')}</th>
                    {table.japanese.map((cell, i) => (
                      <td key={i} className={cell.predicate ? styles.verb : undefined}>
                        {cell.label}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">{t('games.sentenceJa')}</th>
                    {table.japanese.map((cell, i) => (
                      <td key={i} className={`${styles.ja} ${cell.predicate ? styles.verb : ''}`}>
                        {cell.text.split(' ').map((piece, j) => (
                          <span key={j}>
                            {j > 0 && ' '}
                            <Word text={piece} />
                          </span>
                        ))}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            {showRomaji && <p className={shared.hint}>{entry.example.romaji}</p>}
            <div className={styles.actions}>
              <SpeakButton text={entry.example.ja.replace(/\s+/gu, '')} label={t('games.listenSentence')} />
              <button type="button" className="btn btn-primary" autoFocus onClick={next}>
                {t('common.next')}
              </button>
            </div>
          </>
        )}
      </div>
    </GameFrame>
  );
}
