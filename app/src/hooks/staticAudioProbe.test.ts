import { afterEach, describe, expect, it, vi } from 'vitest';
import { playStaticClip, probeStaticClip, resetStaticAudioCache } from './staticAudio';

const json = (body: unknown, ok = true) =>
  ({ ok, headers: new Headers({ 'content-type': 'application/json' }), json: async () => body }) as Response;

afterEach(() => {
  vi.unstubAllGlobals();
  resetStaticAudioCache();
});

describe('clip probe via manifest (QA-046)', () => {
  it('answers from the manifest and fetches it only once', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ clips: ['い', 'ありがとう。'] }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await probeStaticClip('い')).toBe('yes');
    expect(await probeStaticClip('ありがとう')).toBe('yes');
    expect(await probeStaticClip('あ')).toBe('no');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toMatch(/audio\/manifest\.json$/);
  });

  it('a missing manifest (404 or SPA html fallback) means no clips, and play makes no request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'text/html' }) } as Response));
    const audio = vi.fn();
    vi.stubGlobal('Audio', audio);
    expect(await probeStaticClip('あ')).toBe('no');
    expect(await playStaticClip('あ')).toBe(false);
    expect(audio).not.toHaveBeenCalled();
  });

  it('an unreachable manifest is unknown, not a miss', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await probeStaticClip('う')).toBe('unknown');
  });
});
