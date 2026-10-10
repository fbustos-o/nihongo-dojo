import { useMemo, useRef, useState } from 'react';
import { JaText } from '../../components/JaText';
import { SpeakButton } from '../../components/SpeakButton';
import { content } from '../../domain/contentLoader';
import { useSpeech } from '../../hooks/useSpeech';
import { useProgress } from '../../state/progressStore';
import { Feedback, GameFrame, useGameSession, useQuestionPicker, type FeedbackMessage } from '../shared';
import { playSfx } from '../shared/sfx';
import shared from '../shared/games.module.css';
import type { GameProps } from '../types';
import styles from './syntax.module.css';
import { buildSolutionTable, buildTiles, isValidOrder, slotLabelEs, syntaxEntries, type Entry, type Tile } from './syntaxLogic';

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
export function Syntax({ patterns, rounds, sequential, onlyItems, onFinish }: GameProps) {
  const session = useGameSession({ rounds, onFinish });
  const showRomaji = useProgress((s) => s.settings.showRomaji);
  const { speak } = useSpeech();
  const pool = useMemo(() => {
    const all = syntaxEntries(patterns?.length ? patterns : content.patterns);
    const only = onlyItems ? all.filter((e) => onlyItems.includes(e.id)) : all;
    return only.length > 0 ? only : all;
  }, [patterns, onlyItems]);
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
  if (!question) return <p className="muted">No hay frases de práctica para esta lección todavía.</p>;

  const { entry, tiles } = question;
  const byId = new Map(tiles.map((t) => [t.id, t]));
  const answerTokens = placed.map((id) => byId.get(id)!.text);

  const check = () => {
    if (placed.length === 0 || result) return;
    const correct = isValidOrder(entry.tokens, answerTokens);
    session.report(entry.id, 'pattern', entry.example.ja.replace(/\s+/gu, ''), correct);
    playSfx(correct ? 'ok' : 'bad');
    setResult({ correct });
    setMessage({ tone: correct ? 'ok' : 'bad', text: correct ? '¡Correcto! El verbo va al final.' : 'Incorrecto. Así se arma la frase:', id: ++counter.current });
    speak(entry.example.ja.replace(/\s+/gu, ''));
  };

  const next = () => {
    session.next();
    setQuestion(make());
    setPlaced([]);
    setResult(null);
    setMessage(null);
  };

  const table = buildSolutionTable(entry.pattern, entry.tokens);

  return (
    <GameFrame session={session}>
      <div className={shared.round}>
        <p className={styles.sentence} data-testid="prompt">
          {entry.example.es}
        </p>
        <div className={styles.structure} aria-label="Estructura española">
          {entry.pattern.english.map((slot, i) => (
            <span key={i} className={styles.slot}>
              {slotLabelEs(slot.slot)}
            </span>
          ))}
          <span aria-hidden="true">→ en japonés el verbo va al final</span>
        </div>
        <Feedback message={message} />

        <div className={styles.area} aria-label="Tu frase">
          {placed.length === 0 && <p className={styles.areaEmpty}>Toca las fichas para armar la frase</p>}
          {placed.map((id, i) => (
            <button key={id} type="button" className={`${styles.tile} ${byId.get(id)!.particle ? styles.particleTile : ''}`} disabled={result !== null} title="Quitar" onClick={() => setPlaced(placed.filter((_, j) => j !== i))} data-testid={`placed-${i}`}>
              <Word text={byId.get(id)!.text} />
            </button>
          ))}
        </div>

        {!result && (
          <div className={styles.bank} role="group" aria-label="Fichas disponibles">
            {tiles.map((tile) => (
              <button key={tile.id} type="button" className={`${styles.tile} ${tile.particle ? styles.particleTile : ''} ${placed.includes(tile.id) ? styles.used : ''}`} disabled={placed.includes(tile.id)} aria-hidden={placed.includes(tile.id) || undefined} onClick={() => setPlaced([...placed, tile.id])}>
                <Word text={tile.text} />
              </button>
            ))}
          </div>
        )}

        {!result && (
          <div className={styles.actions}>
            <button type="button" className="btn" disabled={placed.length === 0} onClick={() => setPlaced([])}>
              Borrar
            </button>
            <button type="button" className="btn btn-primary" disabled={placed.length === 0} onClick={check}>
              Comprobar
            </button>
          </div>
        )}

        {result && (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table} data-testid="solution-table">
                <caption className="muted">Sintaxis: español → japonés</caption>
                <tbody>
                  <tr>
                    <th scope="row">Estructura española</th>
                    {table.spanish.map((cell, i) => (
                      <td key={i} className={cell.predicate ? styles.verb : undefined}>
                        {cell.label}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Estructura japonesa</th>
                    {table.japanese.map((cell, i) => (
                      <td key={i} className={cell.predicate ? styles.verb : undefined}>
                        {cell.label}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Frase japonesa</th>
                    {table.japanese.map((cell, i) => (
                      <td key={i} className={`${styles.ja} ${cell.predicate ? styles.verb : ''}`}>
                        {cell.text.split(' ').map((t, j) => (
                          <span key={j}>
                            {j > 0 && ' '}
                            <Word text={t} />
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
              <SpeakButton text={entry.example.ja.replace(/\s+/gu, '')} label="Escuchar la frase" />
              <button type="button" className="btn btn-primary" autoFocus onClick={next}>
                Siguiente
              </button>
            </div>
          </>
        )}
      </div>
    </GameFrame>
  );
}
