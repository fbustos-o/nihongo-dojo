import { useContext, useMemo, useState } from 'react';
import { JaText } from '../../components/JaText';
import { SpeakButton } from '../../components/SpeakButton';
import { content } from '../../domain/contentLoader';
import { ExtraKanjiContext } from '../../state/extraKana';
import { useProgress } from '../../state/progressStore';
import { kanaIndex, tokensWithKanji } from '../kanji/kanjiLogic';
import { ChoiceRound, GameFrame, useGameSession } from '../shared';
import shared from '../shared/games.module.css';
import type { GameProps } from '../types';
import styles from './mini-reading.module.css';
import { makeReadingText, sentencesOf, type ReadingText } from './readingLogic';

const QUESTIONS_PER_TEXT = 3;

/**
 * A short text (4-6 sentences taken from the lesson's pattern examples, shown with JaText so only
 * unlocked kana appear as kana) followed by three multiple-choice questions in Spanish.
 */
export function MiniReading({ patterns, rounds, onFinish }: GameProps) {
  const session = useGameSession({ rounds, onFinish });
  const showRomaji = useProgress((s) => s.settings.showRomaji);
  const source = useMemo(() => (patterns && patterns.length > 0 ? patterns : content.patterns), [patterns]);
  const pool = useMemo(() => sentencesOf(content.patterns), []);
  const make = (): ReadingText | null => makeReadingText(source, pool) ?? makeReadingText(content.patterns, pool);

  // Words with unlocked kanji (or the lesson's new ones) are shown in kanji; JaText adds the furigana.
  const unlocked = useProgress((s) => s.unlockedKanji);
  const extra = useContext(ExtraKanjiContext);
  const byKana = useMemo(() => kanaIndex(content.vocab, new Set([...unlocked, ...extra])), [unlocked, extra]);

  const [text, setText] = useState<ReadingText | null>(make);
  const [qi, setQi] = useState(0);
  if (!text) return <p className="muted">No hay textos de lectura para esta lección todavía.</p>;

  const question = text.questions[qi]!;
  const onDone = () => {
    session.next();
    if (qi + 1 >= QUESTIONS_PER_TEXT) {
      setText(make());
      setQi(0);
    } else setQi(qi + 1);
  };

  return (
    <GameFrame session={session}>
      <h2>Lee el texto</h2>
      <ol className={styles.text} data-testid="reading-text">
        {text.sentences.map((s, i) => (
          <li key={s.id} className={styles.line}>
            <span className={styles.num} aria-label={`Frase ${i + 1}`}>
              {i + 1}.
            </span>
            <span className={styles.ja}>
              {tokensWithKanji(s.tokens, byKana).map((t, j) => (
                <span key={j}>
                  {j > 0 && ' '}
                  <JaText word={t.word ?? { kana: t.kana }} />
                </span>
              ))}
              。
            </span>
            <SpeakButton text={s.ja.replace(/\s+/gu, '')} label={`Escuchar frase ${i + 1}`} />
            {showRomaji && <p className={styles.romaji}>{s.romaji}</p>}
          </li>
        ))}
      </ol>
      <ChoiceRound
        key={`${session.round}`}
        prompt={<span className={styles.question}>{question.prompt}</span>}
        small
        options={question.options.map((o) => ({ key: o.key, content: o.text, correct: o.correct }))}
        onReport={(ok) => session.report(question.itemId, 'pattern', question.prompt, ok)}
        onDone={onDone}
      />
      <p className={`muted ${shared.hint}`}>
        Pregunta {qi + 1} de {QUESTIONS_PER_TEXT}
      </p>
    </GameFrame>
  );
}
