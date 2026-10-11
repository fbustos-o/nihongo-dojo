import { useCallback, useEffect, useState } from 'react';
import { useProgress } from '../state/progressStore';
import { playStaticClip, probeStaticClip } from './staticAudio';

const isJapanese = (voice: SpeechSynthesisVoice) => voice.lang.toLowerCase().replace('_', '-').startsWith('ja');

/**
 * Japanese text-to-speech through the Web Speech API. `available` is false when
 * the browser has no speech synthesis or no ja-JP voice installed. `speak` then falls back to a static
 * clip (`public/audio/<id>.mp3`) and reports whether anything played: UI that only needs "a sound button"
 * (SpeakButton) stays enabled until a clip actually fails, while games that depend on audio (Dictado,
 * Escuchar) keep using `available` (voice) to decide on a text fallback.
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
    /** Resolves true when something started playing (voice, or a static clip when there is no voice). */
    async (text: string): Promise<boolean> => {
      if (!synth || !voice) return playStaticClip(text);
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = voice;
        utterance.lang = voice.lang;
        utterance.rate = rate;
        utterance.onerror = (event) => {
          if (event.error !== 'canceled' && event.error !== 'interrupted') void playStaticClip(text);
        };
        synth.cancel();
        synth.speak(utterance);
        return true;
      } catch {
        return playStaticClip(text);
      }
    },
    [synth, voice, rate],
  );

  return { available: voice !== null, speak };
}

/**
 * Whether `text` can be heard: a Japanese voice exists, or a static clip does (probed once with a cached HEAD request).
 * The audio games (Escuchar, Dictado) use this instead of `available` so shipped clips are enough (QA-046).
 */
export function useCanHear(text: string): boolean {
  const { available } = useSpeech();
  const [clip, setClip] = useState<{ text: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (available || !text) return;
    let live = true;
    void probeStaticClip(text).then((r) => live && setClip({ text, ok: r === 'yes' }));
    return () => {
      live = false;
    };
  }, [available, text]);
  return available || (clip?.text === text && clip.ok);
}
