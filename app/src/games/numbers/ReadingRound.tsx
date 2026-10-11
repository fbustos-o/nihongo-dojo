import { useState, type ReactNode } from 'react';
import { useEffect } from 'react';
import { checkAnswer, allReadings, type Reading } from '../../engine';
import { useSpeech } from '../../hooks/useSpeech';
import { JaText } from '../../components/JaText';
import { useProgress } from '../../state/progressStore';
import { ChoiceRound, TypingRound, type Verdict } from '../shared';
import { buildChoices } from './confusions';
import type { Rng } from './random';
import styles from './numbers.module.css';

/** Verdict for a typed reading: any accepted kana (primary or alternative). */
export function readingVerdict(input: string, reading: Reading): Verdict {
  const result = checkAnswer(input, allReadings(reading));
  return result.correct ? 'correct' : result.nearMiss ? 'near' : 'wrong';
}

/** Kana, plus romaji when the setting is on. */
export function KanaWithRomaji({ reading }: { reading: Reading }) {
  const showRomaji = useProgress((s) => s.settings.showRomaji);
  return (
    <>
      <JaText word={{ kana: reading.kana }} />
      {showRomaji && (
        <span lang="en" className={styles.romaji}>
          {' '}
          {reading.romaji}
        </span>
      )}
    </>
  );
}

interface ReadingRoundProps {
  prompt: ReactNode;
  reading: Reading;
  format: 'type' | 'choice';
  /** Other readings that make plausible distractors. */
  related: readonly string[];
  rng?: Rng;
  ariaLabel?: string;
  onReport: (correct: boolean) => void;
  onDone: (firstTry: boolean) => void;
}

/** Asks for a reading in kana: typed (KanaInput) or 4 options. */
export function ReadingRound({ prompt, reading, format, related, rng = Math.random, ariaLabel = 'Lectura en hiragana', onReport, onDone }: ReadingRoundProps) {
  const showRomaji = useProgress((s) => s.settings.showRomaji);
  const [options] = useState(() => buildChoices(reading, related, rng));
  if (format === 'choice' && options.length >= 2) {
    return (
      <ChoiceRound
        prompt={prompt}
        small
        options={options.map((kana) => ({
          key: kana,
          label: kana,
          correct: kana === reading.kana,
          content: <JaText word={{ kana }} />,
        }))}
        onReport={onReport}
        onDone={onDone}
      />
    );
  }
  return (
    <TypingRound
      prompt={prompt}
      answer={<KanaWithRomaji reading={reading} />}
      inputMode="hiragana"
      ariaLabel={ariaLabel}
      placeholder={showRomaji ? 'Escribe en romaji o kana' : 'Escribe en hiragana'}
      evaluate={(input) => readingVerdict(input, reading)}
      onReport={onReport}
      onDone={onDone}
    />
  );
}

/** Speaks `text` whenever `key` changes (if a Japanese voice exists). */
export function useAutoSpeak(text: string, key: unknown): boolean {
  const { available, speak } = useSpeech();
  useEffect(() => {
    if (available && text) speak(text);
  }, [available, speak, text, key]);
  return available;
}

interface ChipsProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

/** Small toggle group used by free practice to pick a mode. */
export function ModeChips<T extends string>({ label, value, options, onChange }: ChipsProps<T>) {
  return (
    <div role="group" aria-label={label} className={styles.chips}>
      {options.map((o) => (
        <button key={o.value} type="button" className={styles.chip} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
