import { useCallback, useEffect, useState } from 'react';
import { useProgress } from '../state/progressStore';

const isJapanese = (voice: SpeechSynthesisVoice) => voice.lang.toLowerCase().replace('_', '-').startsWith('ja');

/**
 * Japanese text-to-speech through the Web Speech API. `available` is false when
 * the browser has no speech synthesis or no ja-JP voice installed.
 */
export function useSpeech() {
  const rate = useProgress((s) => s.settings.ttsRate);
  const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (!synth) return;
    const pickVoice = () => setVoice(synth.getVoices().find(isJapanese) ?? null);
    pickVoice();
    synth.addEventListener('voiceschanged', pickVoice);
    return () => synth.removeEventListener('voiceschanged', pickVoice);
  }, [synth]);

  const speak = useCallback(
    (text: string) => {
      if (!synth || !voice) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = rate;
      synth.cancel();
      synth.speak(utterance);
    },
    [synth, voice, rate],
  );

  return { available: voice !== null, speak };
}
