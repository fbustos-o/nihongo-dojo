import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clipKey, clipUrl, playStaticClip, resetStaticAudioCache } from './staticAudio';

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

beforeEach(() => {
  created.length = 0;
  resetStaticAudioCache();
  playImpl = () => Promise.resolve();
  vi.stubGlobal('Audio', FakeAudio);
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
});
