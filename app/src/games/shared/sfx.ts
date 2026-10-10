import { useProgress } from '../../state/progressStore';

let ctx: AudioContext | null = null;

/** Short beep for right / wrong answers. Does nothing unless the "sound" setting is on. */
export function playSfx(kind: 'ok' | 'bad'): void {
  if (!useProgress.getState().settings.sound) return;
  try {
    const Ctor = window.AudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = kind === 'ok' ? 880 : 220;
    gain.gain.value = 0.05;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    /* audio is optional */
  }
}
