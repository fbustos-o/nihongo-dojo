import { useProgress } from '../../state/progressStore';

let ctx: AudioContext | null = null;

/** Short beep for right / wrong answers. Does nothing unless the "sound" setting is on. */
export function playSfx(kind: 'ok' | 'bad' | 'celebrate'): void {
  if (!useProgress.getState().settings.sound) return;
  try {
    const Ctor = window.AudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    // 'celebrate' = a short rising arpeggio (C5 E5 G5); the others are single beeps
    const notes = kind === 'celebrate' ? [523, 659, 784] : [kind === 'ok' ? 880 : 220];
    notes.forEach((frequency, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.frequency.value = frequency;
      gain.gain.value = 0.05;
      osc.connect(gain).connect(ctx!.destination);
      const start = ctx!.currentTime + i * 0.11;
      osc.start(start);
      osc.stop(start + 0.12);
    });
  } catch {
    /* audio is optional */
  }
}
