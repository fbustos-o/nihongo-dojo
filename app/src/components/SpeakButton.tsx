import { useState } from 'react';
import { useSpeech } from '../hooks/useSpeech';

interface SpeakButtonProps {
  text: string;
  label?: string;
  /** Icon only (inside a result banner, where there is no room for text). */
  iconOnly?: boolean;
}

/** Visible label so it reads as a button: phones show «Escuchar» (or the label when it is that short), wide screens the full label. */
export function SpeakButton({ text, label = 'Escuchar', iconOnly = false }: SpeakButtonProps) {
  const short = label.length <= 10 ? label : 'Escuchar';
  const { available, speak } = useSpeech();
  // Without a voice the button still tries the static clip; it only gives up once that fails.
  const [noClip, setNoClip] = useState(false);
  const usable = available || !noClip;
  return (
    <button
      type="button"
      className={`btn speak-btn${iconOnly ? ' speak-btn-icon' : ''}`}
      disabled={!usable}
      aria-label={label}
      title={usable ? label : 'Tu navegador no tiene una voz en japonés disponible'}
      onClick={() => {
        void speak(text).then((played) => {
          if (!played && !available) setNoClip(true);
        });
      }}
    >
      <span aria-hidden="true" className="speak-icon">🔊</span>
      {!iconOnly && (
        <>
          <span aria-hidden="true" className="speak-label">{label}</span>
          <span aria-hidden="true" className="speak-label-short">{short}</span>
        </>
      )}
    </button>
  );
}
