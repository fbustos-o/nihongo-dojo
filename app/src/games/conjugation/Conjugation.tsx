import { useMemo, useState } from 'react';
import { JaText } from '../../components/JaText';
import { KanaInput } from '../../components/KanaInput';
import { content } from '../../domain/contentLoader';
import type { Word } from '../../domain/schema';
import { checkAnswer } from '../../engine';
import { Feedback, GameFrame, TypingRound, useGameSession, useQuestionPicker, type FeedbackMessage, type GameSession } from '../shared';
import shared from '../shared/games.module.css';
import { shuffle } from '../kanaUtils';
import type { GameProps } from '../types';
import { meaningOf } from '../wordUtils';
import {
  ALL_FORMS,
  CATEGORIES,
  CATEGORY_LABELS,
  acceptedFor,
  conjEntries,
  conjugableWords,
  entryId,
  formLabel,
  formsForLesson,
  readingFor,
  ruleHint,
  type AnyForm,
  type Category,
  type ConjEntry,
  type FormConfig,
} from './conjugationLogic';
import styles from './conjugation.module.css';

type Mode = 'quiz' | 'table';

const TABLE_ROWS = 4;

/**
 * Conjugation practice. Quiz mode: dictionary form + requested form -> type it. Table mode: the
 * teacher's grid (verbs x forms). The forms that appear depend on the lesson (see `formsForLesson`);
 * in free practice the learner picks them.
 */
export function Conjugation({ words, rounds, sequential, lessonId, patterns, onFinish }: GameProps) {
  const session = useGameSession({ rounds, onFinish });
  const free = lessonId === undefined;
  const config = useMemo(() => formsForLesson(lessonId, patterns?.map((p) => p.id)), [lessonId, patterns]);
  const pools = useMemo(() => {
    const out = {} as Record<Category, Word[]>;
    for (const c of CATEGORIES) {
      const own = conjugableWords(words, c);
      out[c] = own.length > 0 ? own : conjugableWords(content.vocab, c);
    }
    return out;
  }, [words]);
  const categories = CATEGORIES.filter((c) => config[c].length > 0 && pools[c].length > 0);

  const [mode, setMode] = useState<Mode>('quiz');
  const [chosen, setChosen] = useState<Category | null>(null);
  const [selected, setSelected] = useState<FormConfig>(() => ({ ...ALL_FORMS, verb: ALL_FORMS.verb.slice(0, 4) }));

  if (categories.length === 0) return <p className="muted">No hay palabras para conjugar todavía.</p>;
  const category = chosen && categories.includes(chosen) ? chosen : categories[0]!;
  const forms: AnyForm[] = free ? selected[category] : config[category];

  const toggleForm = (form: AnyForm) => {
    const current: AnyForm[] = selected[category];
    const next = current.includes(form) ? current.filter((f) => f !== form) : ALL_FORMS[category].filter((f) => f === form || current.includes(f));
    if (next.length === 0) return;
    setSelected({ ...selected, [category]: next });
  };

  return (
    <GameFrame session={session}>
      <div className={styles.toolbar}>
        <div className={styles.seg} role="group" aria-label="Modo">
          <button type="button" className={styles.segBtn} aria-pressed={mode === 'quiz'} onClick={() => setMode('quiz')}>
            Preguntas
          </button>
          <button type="button" className={styles.segBtn} aria-pressed={mode === 'table'} onClick={() => setMode('table')}>
            Tabla
          </button>
        </div>
        {categories.length > 1 && (
          <div className={styles.seg} role="group" aria-label="Tipo de palabra">
            {categories.map((c) => (
              <button key={c} type="button" className={styles.segBtn} aria-pressed={c === category} onClick={() => setChosen(c)}>
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        )}
      </div>
      {free && (
        <fieldset className={styles.forms}>
          <legend>Formas a practicar</legend>
          {ALL_FORMS[category].map((form) => (
            <label key={form}>
              <input type="checkbox" checked={forms.includes(form)} onChange={() => toggleForm(form)} />
              {formLabel(category, form).split(' (')[0]}
            </label>
          ))}
        </fieldset>
      )}
      {mode === 'quiz' ? (
        <QuizPane key={`${category}|${forms.join()}`} category={category} words={pools[category]} forms={forms} session={session} sequential={sequential} />
      ) : (
        <TablePane key={`${category}|${forms.join()}`} category={category} words={pools[category]} forms={forms} session={session} />
      )}
    </GameFrame>
  );
}

interface PaneProps {
  category: Category;
  words: Word[];
  forms: AnyForm[];
  session: GameSession;
}

function QuizPane({ category, words, forms, session, sequential }: PaneProps & { sequential?: boolean }) {
  const pool = useMemo(() => conjEntries(words, category, forms), [words, category, forms]);
  const pick = useQuestionPicker('word', sequential);
  const [entry, setEntry] = useState<ConjEntry>(() => pick(pool));
  const [last, setLast] = useState<FeedbackMessage | null>(null);

  const { word, form } = entry;
  const accepted = acceptedFor(word, category, form);
  const hint = ruleHint(word, category, form);
  const primary = readingFor(word, category, form).kana;

  return (
    <>
      {last && <Feedback message={last} />}
      <TypingRound
        key={session.round}
        prompt={
          <>
            <span className={styles.word} data-testid="word-prompt">
              <JaText word={word} />
            </span>
            <p className={styles.target}>{meaningOf(word)}</p>
            <p className={styles.formName} data-testid="form-label">
              {formLabel(category, form)}
            </p>
          </>
        }
        answer={
          <>
            <JaText word={{ kana: primary }} />
            <span className={styles.hintLine} style={{ display: 'block' }}>{hint}</span>
          </>
        }
        evaluate={(input) => {
          const result = checkAnswer(input, accepted);
          return result.correct ? 'correct' : result.nearMiss ? 'near' : 'wrong';
        }}
        inputMode="hiragana"
        ariaLabel="Conjugación en kana"
        placeholder="escribe en kana"
        onReport={(ok) => {
          setLast(null);
          session.report(entry.id, 'word', `${word.kana} → ${primary}`, ok);
        }}
        onDone={(firstTry) => {
          setLast(firstTry ? { tone: 'ok', text: `¡Correcto! ${primary} · ${hint}`, id: session.round } : null);
          session.next();
          setEntry(pick(pool));
        }}
      />
    </>
  );
}

interface RowResult {
  cells: Record<string, boolean>;
}

function TablePane({ category, words, forms, session }: PaneProps) {
  const [tableId, setTableId] = useState(0);
  const [rows, setRows] = useState<Word[]>(() => shuffle(words).slice(0, TABLE_ROWS));
  const [values, setValues] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, RowResult>>({});
  const cellKey = (word: Word, form: AnyForm) => `${word.id}|${form}`;
  const allChecked = rows.every((w) => results[w.id]);

  const checkRow = (word: Word) => {
    const cells: Record<string, boolean> = {};
    for (const form of forms) {
      const ok = checkAnswer(values[cellKey(word, form)] ?? '', acceptedFor(word, category, form)).correct;
      cells[form] = ok;
      session.report(entryId(category, word, form), 'word', `${word.kana} → ${readingFor(word, category, form).kana}`, ok);
    }
    setResults({ ...results, [word.id]: { cells } });
  };

  const again = () => {
    setRows(shuffle(words).slice(0, TABLE_ROWS));
    setValues({});
    setResults({});
    setTableId((n) => n + 1);
    session.next();
  };

  return (
    <div className={shared.round}>
      <p className="muted">Completa cada fila con la conjugación en kana y pulsa «Comprobar fila».</p>
      <div className={styles.tableWrap}>
        <table className={styles.grid} data-testid="conjugation-table">
          <thead>
            <tr>
              <th scope="col">Diccionario</th>
              {forms.map((form) => (
                <th key={form} scope="col">
                  {formLabel(category, form)}
                </th>
              ))}
              <th scope="col" aria-label="Comprobar" />
            </tr>
          </thead>
          <tbody>
            {rows.map((word) => {
              const result = results[word.id];
              return (
                <tr key={word.id}>
                  <th scope="row">
                    <JaText word={word} />
                    <span className={styles.rowInfo}>
                      {meaningOf(word)}
                      {result && category === 'verb' ? ` · ${ruleHint(word, category, forms[0]!).split(':')[0]}` : ''}
                    </span>
                  </th>
                  {forms.map((form) => {
                    const ok = result?.cells[form];
                    return (
                      <td key={form} className={ok === undefined ? undefined : ok ? styles.cellOk : styles.cellBad}>
                        <KanaInput
                          key={`${tableId}-${word.id}-${form}`}
                          mode="hiragana"
                          aria-label={`${word.kana}: ${formLabel(category, form)}`}
                          disabled={result !== undefined}
                          onChange={(v) => setValues((cur) => ({ ...cur, [cellKey(word, form)]: v }))}
                        />
                        {result && (
                          <span className={styles.expected}>
                            {ok ? '✓' : `✗ ${readingFor(word, category, form).kana}`}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td>
                    <button type="button" className="btn" disabled={result !== undefined} onClick={() => checkRow(word)}>
                      Comprobar fila
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {allChecked && (
        <button type="button" className="btn btn-primary" autoFocus onClick={again}>
          Nueva tabla
        </button>
      )}
    </div>
  );
}
