import { useState } from 'react';
import { useSpeech } from '../hooks/useSpeech';

interface SpeakButtonProps {
  text: string;
  label?: string;
}

/** Compact icon button (44-56 px); the text label only shows on wide screens, aria-label always names it. */
export function SpeakButton({ text, label = 'Escuchar' }: SpeakButtonProps) {
  const { available, speak } = useSpeech();
  // Without a voice the button still tries the static clip; it only gives up once that fails.
  const [noClip, setNoClip] = useState(false);
  const usable = available || !noClip;
  return (
    <button
      type="button"
      className="btn speak-btn"
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
      <span aria-hidden="true" className="speak-label">{label}</span>
    </button>
  );
}
