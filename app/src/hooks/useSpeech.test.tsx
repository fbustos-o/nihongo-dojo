import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStaticAudioCache } from './staticAudio';
import { useSpeech } from './useSpeech';

const played: string[] = [];
class FakeAudio {
  currentTime = 0;
  preload = '';
  constructor(public src: string) {}
  play() {
    played.push(this.src);
    return Promise.resolve();
  }
}
class FakeUtterance {
  voice: unknown;
  lang = '';
  rate = 1;
  onerror: ((e: { error: string }) => void) | null = null;
  constructor(public text: string) {}
}

function setupSynth(voices: { lang: string }[], speak: (u: FakeUtterance) => void = () => undefined) {
  const synth = {
    getVoices: () => voices,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    cancel: () => undefined,
    speak,
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
}

beforeEach(() => {
  played.length = 0;
  resetStaticAudioCache();
  vi.stubGlobal('Audio', FakeAudio);
});

describe('useSpeech', () => {
  it('uses speechSynthesis when a ja voice exists', () => {
    const spoken = vi.fn();
    setupSynth([{ lang: 'ja-JP' }], spoken);
    const { result } = renderHook(() => useSpeech());
    expect(result.current.available).toBe(true);
    act(() => {
      void result.current.speak('あ');
    });
    expect(spoken).toHaveBeenCalledTimes(1);
    expect(played).toHaveLength(0);
  });

  it('falls back to a static clip without a ja voice', async () => {
    setupSynth([{ lang: 'en-US' }]);
    const { result } = renderHook(() => useSpeech());
    expect(result.current.available).toBe(false);
    await act(async () => {
      await result.current.speak('あ');
    });
    expect(played).toHaveLength(1);
    expect(played[0]).toMatch(/audio\/.+\.mp3$/);
  });

  it('falls back when speak throws or errors', async () => {
    setupSynth([{ lang: 'ja-JP' }], () => {
      throw new Error('boom');
    });
    const { result } = renderHook(() => useSpeech());
    await act(async () => {
      await result.current.speak('い');
    });
    expect(played).toHaveLength(1);

    setupSynth([{ lang: 'ja-JP' }], (u) => u.onerror?.({ error: 'synthesis-failed' }));
    const second = renderHook(() => useSpeech());
    await act(async () => {
      await second.result.current.speak('う');
    });
    expect(played).toHaveLength(2);
  });

  it('speak resolves true when a clip played and false when nothing could', async () => {
    setupSynth([{ lang: 'en-US' }]);
    const { result } = renderHook(() => useSpeech());
    let ok = false;
    await act(async () => {
      ok = await result.current.speak('あ');
    });
    expect(ok).toBe(true);
    vi.stubGlobal('Audio', class {
      play() {
        return Promise.reject(new Error('404'));
      }
    });
    resetStaticAudioCache();
    await act(async () => {
      ok = await result.current.speak('い');
    });
    expect(ok).toBe(false);
  });
});
