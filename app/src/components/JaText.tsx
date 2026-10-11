import { renderPlan, type RenderableWord, type RomajiMode } from '../domain/renderPlan';
import { useUnlockState } from '../state/progressStore';
import styles from './JaText.module.css';

interface JaTextProps {
  /** A vocabulary Word or any `{ kana, kanji? }`. */
  word?: RenderableWord;
  /** Shorthand for `word={{ kana: text }}`: plain kana (spaces, ー and punctuation allowed), e.g. an answer option «で». */
  text?: string;
  /**
   * How kana the learner has not unlocked yet are shown. `ruby` (default): the text stays in kana and each unknown kana
   * carries its romaji as ruby. `inline`: unknown kana are replaced by romaji mixed into the text (old behaviour).
   * Independent of the «mostrar romaji» setting.
   */
  romajiMode?: RomajiMode;
}

/** Shows Japanese text according to what the learner has unlocked (see `renderPlan`). */
export function JaText({ word, text, romajiMode = 'ruby' }: JaTextProps) {
  const segments = renderPlan(word ?? { kana: text ?? '' }, useUnlockState(), romajiMode);
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
          case 'kanaRuby':
            return (
              <ruby key={index} className={styles.kanaRuby} data-testid="kana-ruby">
                {segment.kana}
                <rt lang="en">{segment.romaji}</rt>
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
