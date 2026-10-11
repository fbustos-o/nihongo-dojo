import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Feedback, type FeedbackMessage } from './Feedback';
import { useFirstAttempt } from './useFirstAttempt';
import styles from './games.module.css';

export interface ChoiceOption {
  key: string;
  content: ReactNode;
  /** Accessible name when `content` is not plain text. */
  label?: string;
  correct: boolean;
}

interface ChoiceRoundProps {
  prompt: ReactNode;
  options: ChoiceOption[];
  small?: boolean;
  /** Message for a wrong pick; default is a generic "Incorrecto". */
  wrongFeedback?: (option: ChoiceOption) => { text: string; node?: ReactNode };
  onReport: (correct: boolean) => void;
  onDone: (firstTry: boolean) => void;
}

/** Multiple-choice question. A wrong pick is reported once, disabled, and the learner must find the right one. Keys 1-4 pick an option. */
export function ChoiceRound({ prompt, options, small, wrongFeedback, onReport, onDone }: ChoiceRoundProps) {
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const counter = useRef(0);
  const { wrongKeys, attempt } = useFirstAttempt(onReport, onDone);

  const pick = (option: ChoiceOption) => {
    if (attempt(option.key, option.correct)) return;
    const custom = wrongFeedback?.(option);
    setMessage({ tone: 'bad', text: custom?.text ?? 'Incorrecto. Elige la respuesta correcta para continuar.', node: custom?.node, id: ++counter.current });
  };

  // Keys 1-4 pick the option in that position (ignored while typing in a field, or with a modifier).
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || !/^[1-4]$/.test(e.key)) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    const option = options[Number(e.key) - 1];
    if (!option || wrongKeys.includes(option.key)) return;
    e.preventDefault();
    pick(option);
  };
  const latestKey = useRef(onKey);
  useEffect(() => {
    latestKey.current = onKey;
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => latestKey.current(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className={styles.round}>
      <div className={styles.prompt} data-testid="prompt">{prompt}</div>
      <Feedback message={message} />
      <div className={styles.choices}>
        {options.map((option, index) => (
          <button
            key={option.key}
            type="button"
            className={`${styles.choice} ${small ? styles.choiceSmall : ''}`}
            disabled={wrongKeys.includes(option.key)}
            aria-label={option.label}
            aria-keyshortcuts={index < 4 ? String(index + 1) : undefined}
            onClick={() => pick(option)}
          >
            {option.content}
          </button>
        ))}
      </div>
    </div>
  );
}
