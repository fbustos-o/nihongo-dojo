import { useEffect, useRef, useState } from 'react';
import { JaText } from '../../components/JaText';
import { SpeakButton } from '../../components/SpeakButton';
import { glosses, wordNote } from '../../domain/glosses';
import type { Word } from '../../domain/schema';
import { useT, useMeaningLang } from '../../i18n';
import { itemKey } from '../../state/progressSchema';
import { useProgress } from '../../state/progressStore';
import { GameFrame, useGameSession } from '../shared';
import type { GameProps } from '../types';
import styles from './flashcards.module.css';

/** Fisher-Yates copy. */
function shuffled<T>(list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** True when the key event comes from something that handles keys itself (fields, buttons, links). */
const isInteractive = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(target.tagName);

/**
 * Flashcards: the word on the front (JaText + audio); a tap turns the card and shows the meanings, romaji, how it is
 * written (`written`), the note and the Core rank. Then «Ya la sé» / «Todavía no» report the word.
 * Without `rounds` it goes through every word once (in order with `sequential`, shuffled otherwise).
 */
export function Flashcards({ words, rounds, sequential, onFinish }: GameProps) {
  const total = rounds ?? words.length;
  const session = useGameSession({ rounds: total, onFinish });
  const t = useT();
  const lang = useMeaningLang();
  const showRomaji = useProgress((s) => s.settings.showRomaji);
  const [deck] = useState(() => (sequential ? [...words] : shuffled(words)));
  const [flipped, setFlipped] = useState(false);
  const flippedRef = useRef(false);
  const word: Word | undefined = deck.length ? deck[session.round % deck.length] : undefined;

  const answer = (ok: boolean) => {
    if (!word) return;
    const stage = useProgress.getState().items[itemKey('word', word.id)]?.srsStage ?? 0;
    // a brand-new word whose first correct answer this is counts towards today's «palabras nuevas»
    if (ok && stage === 0) useProgress.getState().countNewWord();
    session.report(word.id, 'word', word.kana, ok);
    setFlipped(false);
    session.next();
  };
  const answerRef = useRef(answer);
  // refs are refreshed after every render so the key handler (subscribed once) sees the current card
  useEffect(() => {
    flippedRef.current = flipped;
    answerRef.current = answer;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === ' ' && !isInteractive(e.target)) {
        e.preventDefault();
        if (!flippedRef.current) setFlipped(true);
      } else if (flippedRef.current && (e.key === '1' || e.key === '2') && !isInteractive(e.target)) {
        answerRef.current(e.key === '1');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!word) return <p className="muted">{t('flashcards.empty')}</p>;

  const note = wordNote(word, lang);
  return (
    <GameFrame session={session}>
      <p className={`muted ${styles.counter}`} data-testid="flashcard-counter">
        {t('flashcards.counter', { n: Math.min(session.round + 1, total), total })}
      </p>
      <div className={styles.wrap}>
        <button
          type="button"
          className={`${styles.card} ${flipped ? styles.flipped : ''}`}
          aria-expanded={flipped}
          aria-label={flipped ? undefined : t('flashcards.flip')}
          onClick={() => setFlipped((f) => !f)}
          data-testid="flashcard"
        >
          <span className={styles.front} data-testid="flashcard-front">
            <JaText word={word} />
          </span>
          {!flipped && <span className={`muted ${styles.tap}`}>{t('flashcards.flip')}</span>}
          {flipped && (
            <span className={styles.back} data-testid="flashcard-back">
              <span className={styles.meaning}>{glosses(word, lang).join('; ')}</span>
              {showRomaji && <span className="muted">{word.romaji}</span>}
              {word.written && (
                <span className="muted">
                  {t('flashcards.writtenAs')} <span lang="ja">{word.written}</span>
                </span>
              )}
              {note && <span className="muted">{note}</span>}
              {word.rank !== undefined && <span className={styles.badge}>{t('flashcards.core', { rank: word.rank })}</span>}
            </span>
          )}
        </button>
        <SpeakButton text={word.kana} label={t('common.listen')} />
      </div>
      {flipped ? (
        <div className={styles.answers}>
          <button type="button" className={`btn btn-primary ${styles.answer}`} onClick={() => answer(true)}>
            {t('flashcards.know')}
          </button>
          <button type="button" className={`btn ${styles.answer}`} onClick={() => answer(false)}>
            {t('flashcards.notYet')}
          </button>
        </div>
      ) : (
        <p className={`muted ${styles.keys}`}>{t('flashcards.keys')}</p>
      )}
    </GameFrame>
  );
}
