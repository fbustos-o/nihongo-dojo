import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clipKey, clipUrl, playStaticClip, preloadStaticClips, resetStaticAudioCache } from './staticAudio';

const created: string[] = [];
let playImpl: () => Promise<void>;

class FakeAudio {
  currentTime = 0;
  preload = '';
  constructor(public src: string) {
    created.push(src);
  }
  play() {
    return playImpl();
  }
}

async function withManifest(clips: string[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ clips }) }),
  );
  await preloadStaticClips();
}

beforeEach(async () => {
  created.length = 0;
  resetStaticAudioCache();
  playImpl = () => Promise.resolve();
  vi.stubGlobal('Audio', FakeAudio);
  await withManifest(['あ', 'い', 'う', 'え', 'お']);
});

describe('static audio fallback', () => {
  it('normalizes keys', () => {
    expect(clipKey('ありがとう。')).toBe('ありがとう');
    expect(clipKey('わたし は がくせい！')).toBe('わたしはがくせい');
    expect(clipKey('ｶﾀｶﾅ')).toBe('カタカナ');
  });

  it('builds URLs under the base path', () => {
    expect(clipUrl('あ', '/nihongo-dojo/')).toBe(`/nihongo-dojo/audio/${encodeURIComponent('あ')}.mp3`);
  });

  it('plays an existing clip', async () => {
    expect(await playStaticClip('あ')).toBe(true);
    expect(created).toHaveLength(1);
  });

  it('tries a missing clip only once', async () => {
    playImpl = () => Promise.reject(new Error('404'));
    expect(await playStaticClip('い')).toBe(false);
    expect(await playStaticClip('い')).toBe(false);
    expect(created).toHaveLength(1);
  });

  it('never requests a clip that is not in the manifest (no 404 noise)', async () => {
    expect(await playStaticClip('か')).toBe(false);
    expect(created).toHaveLength(0);
  });
});
