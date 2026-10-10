import { renderPlan, type RenderableWord } from '../domain/renderPlan';
import { useUnlockState } from '../state/progressStore';
import styles from './JaText.module.css';

interface JaTextProps {
  /** A vocabulary Word or any `{ kana, kanji? }`. */
  word: RenderableWord;
}

/** Shows Japanese text according to what the learner has unlocked (see `renderPlan`). */
export function JaText({ word }: JaTextProps) {
  const segments = renderPlan(word, useUnlockState());
  return (
    <span lang="ja" className={styles.ja}>
      {segments.map((segment, index) => {
        switch (segment.type) {
          case 'ruby':
            return (
              <ruby key={index}>
                {segment.base}
                <rt>{segment.reading}</rt>
              </ruby>
            );
          case 'romaji':
            return (
              <span key={index} lang="en" className={styles.romaji}>
                {segment.text}
              </span>
            );
          case 'text':
            return <span key={index}>{segment.text}</span>;
        }
      })}
    </span>
  );
}
