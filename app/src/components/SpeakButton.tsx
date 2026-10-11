import { useSpeech } from '../hooks/useSpeech';

interface SpeakButtonProps {
  text: string;
  label?: string;
}

/** Compact icon button (44-56 px); the text label only shows on wide screens, aria-label always names it. */
export function SpeakButton({ text, label = 'Escuchar' }: SpeakButtonProps) {
  const { available, speak } = useSpeech();
  return (
    <button
      type="button"
      className="btn speak-btn"
      disabled={!available}
      aria-label={label}
      title={available ? label : 'Tu navegador no tiene una voz en japonés disponible'}
      onClick={() => speak(text)}
    >
      <span aria-hidden="true" className="speak-icon">🔊</span>
      <span aria-hidden="true" className="speak-label">{label}</span>
    </button>
  );
}
