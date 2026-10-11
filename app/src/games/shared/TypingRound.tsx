import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { KanaInput } from '../../components/KanaInput';
import { Feedback, type FeedbackMessage } from './Feedback';
import { playSfx } from './sfx';
import { useKeepInView } from './useKeepInView';
import styles from './games.module.css';

export type Verdict = 'correct' | 'near' | 'wrong';

interface TypingRoundProps {
  prompt: ReactNode;
  /** What the learner must type, shown when they are wrong. */
  answer: ReactNode;
  /** Plain text to compare in the forced retype (the evaluator's own expected text). */
  evaluate: (input: string) => Verdict;
  inputMode: 'plain' | 'hiragana' | 'katakana';
  ariaLabel: string;
  placeholder?: string;
  /** Called once per round with the first-attempt result. */
  onReport: (correct: boolean) => void;
  /** Called when the round is over (right first time, or after the forced retype). */
  onDone: (firstTry: boolean) => void;
}

/**
 * One typed question. First attempt right: report + done. Wrong / near miss: report once as wrong,
 * show the answer and require typing it correctly before continuing (brute-force style).
 */
export function TypingRound({ prompt, answer, evaluate, inputMode, ariaLabel, placeholder, onReport, onDone }: TypingRoundProps) {
  const [value, setValue] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [retype, setRetype] = useState(false);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const counter = useRef(0);
  const roundRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  useKeepInView(roundRef, promptRef);
  const say = (tone: FeedbackMessage['tone'], text: string) => setMessage({ tone, text, id: ++counter.current });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (value.trim() === '') return;
    const verdict = evaluate(value);
    if (verdict === 'correct') {
      if (!retype) {
        onReport(true);
        playSfx('ok');
      }
      onDone(!retype);
      return;
    }
    if (!retype) {
      onReport(false);
      setRetype(true);
    }
    playSfx('bad');
    say(verdict === 'near' ? 'near' : 'bad', verdict === 'near' ? 'Casi. Escribe la respuesta correcta para continuar:' : 'Incorrecto. Escribe la respuesta correcta para continuar:');
    setValue('');
    setAttempt((a) => a + 1);
  };

  const inputProps = {
    'aria-label': ariaLabel,
    placeholder: retype ? 'Escribe la respuesta' : placeholder,
    className: styles.input,
    autoFocus: true,
    enterKeyHint: 'done' as const,
  };

  return (
    <div className={styles.round} ref={roundRef}>
      <div className={styles.prompt} ref={promptRef} data-testid="prompt">{prompt}</div>
      <Feedback message={message} />
      {retype && (
        <p className={styles.answer} data-testid="correct-answer">
          {answer}
        </p>
      )}
      <form onSubmit={submit} className={styles.form}>
        {inputMode === 'plain' ? (
          <input key={attempt} {...inputProps} type="text" value={value} onChange={(e) => setValue(e.target.value)} />
        ) : (
          <KanaInput key={attempt} {...inputProps} mode={inputMode} onChange={setValue} />
        )}
        <button type="submit" className="btn btn-primary">
          Comprobar
        </button>
      </form>
    </div>
  );
}
