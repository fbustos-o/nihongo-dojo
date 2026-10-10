import { useSpeech } from '../hooks/useSpeech';

interface SpeakButtonProps {
  text: string;
  label?: string;
}

export function SpeakButton({ text, label = 'Escuchar' }: SpeakButtonProps) {
  const { available, speak } = useSpeech();
  return (
    <button
      type="button"
      className="btn"
      disabled={!available}
      title={available ? label : 'Tu navegador no tiene una voz en japonés disponible'}
      onClick={() => speak(text)}
    >
      🔊 {label}
    </button>
  );
}
