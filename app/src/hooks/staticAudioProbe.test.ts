import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAudioResponse, playStaticClip, probeStaticClip, resetStaticAudioCache } from './staticAudio';

const res = (ok: boolean, type: string) => ({ ok, headers: new Headers({ 'content-type': type }) }) as Response;

afterEach(() => {
  vi.unstubAllGlobals();
  resetStaticAudioCache();
});

describe('clip probe (QA-046)', () => {
  it('treats a 200 text/html answer (SPA fallback) as a miss and audio/mpeg as a hit', async () => {
    expect(isAudioResponse(res(true, 'text/html'))).toBe(false);
    expect(isAudioResponse(res(false, 'audio/mpeg'))).toBe(false);
    expect(isAudioResponse(res(true, 'audio/mpeg'))).toBe(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(true, 'text/html')));
    expect(await probeStaticClip('あ')).toBe('no');
    expect(await playStaticClip('あ')).toBe(false);
  });

  it('caches the HEAD request per clip', async () => {
    const hit = vi.fn().mockResolvedValue(res(true, 'audio/mpeg'));
    vi.stubGlobal('fetch', hit);
    expect(await probeStaticClip('い')).toBe('yes');
    await probeStaticClip('い');
    expect(hit).toHaveBeenCalledTimes(1);
  });

  it('a failed request is unknown, not a miss', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await probeStaticClip('う')).toBe('unknown');
  });
});
