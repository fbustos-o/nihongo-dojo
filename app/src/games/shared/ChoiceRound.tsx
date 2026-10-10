import { useRef, useState, type ReactNode } from 'react';
import { Feedback, type FeedbackMessage } from './Feedback';
import { playSfx } from './sfx';
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
  onReport: (correct: boolean) => void;
  onDone: (firstTry: boolean) => void;
}

/** Multiple-choice question. A wrong pick is reported once, disabled, and the learner must find the right one. */
export function ChoiceRound({ prompt, options, small, onReport, onDone }: ChoiceRoundProps) {
  const [wrongKeys, setWrongKeys] = useState<string[]>([]);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const counter = useRef(0);

  const pick = (option: ChoiceOption) => {
    if (option.correct) {
      if (wrongKeys.length === 0) {
        onReport(true);
        playSfx('ok');
      }
      onDone(wrongKeys.length === 0);
      return;
    }
    if (wrongKeys.length === 0) onReport(false);
    playSfx('bad');
    setWrongKeys((keys) => [...keys, option.key]);
    setMessage({ tone: 'bad', text: 'Incorrecto. Elige la respuesta correcta para continuar.', id: ++counter.current });
  };

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
            aria-keyshortcuts={String(index + 1)}
            onClick={() => pick(option)}
          >
            {option.content}
          </button>
        ))}
      </div>
    </div>
  );
}
