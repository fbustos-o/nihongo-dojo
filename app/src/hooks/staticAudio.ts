/**
 * Static audio fallback: clips served from `${BASE_URL}audio/<key>.mp3`.
 * Key scheme: NFKC-normalize the text, drop whitespace and punctuation/symbols (Unicode P*, S*), keep
 * kana/kanji as they are. "ありがとう。" -> "ありがとう"; the URL path is percent-encoded.
 */
export function clipKey(text: string): string {
  return text.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '');
}

export function clipUrl(text: string, base: string = import.meta.env.BASE_URL): string {
  return `${base}audio/${encodeURIComponent(clipKey(text))}.mp3`;
}

const missing = new Set<string>();
const loaded = new Map<string, HTMLAudioElement>();
const probes = new Map<string, Promise<ClipProbe>>();

/** `unknown`: the request itself failed (offline, no fetch), so the clip may still exist. */
export type ClipProbe = 'yes' | 'no' | 'unknown';

/** Test helper. */
export function resetStaticAudioCache(): void {
  missing.clear();
  loaded.clear();
  probes.clear();
}

/** A response that is a real clip: 2xx and an audio content type (a SPA fallback answers 200 text/html). */
export const isAudioResponse = (res: Pick<Response, 'ok' | 'headers'>): boolean => {
  if (!res.ok) return false;
  const type = (res.headers.get('content-type') ?? '').toLowerCase();
  return type.startsWith('audio/') || type.startsWith('application/octet-stream') || type.startsWith('video/');
};

/** Whether a clip exists for `text`: one cached HEAD request per key (QA-046). */
export function probeStaticClip(text: string): Promise<ClipProbe> {
  const key = clipKey(text);
  if (!key) return Promise.resolve('no');
  if (missing.has(key)) return Promise.resolve('no');
  let probe = probes.get(key);
  if (!probe) {
    probe =
      typeof fetch !== 'function'
        ? Promise.resolve<ClipProbe>('unknown')
        : fetch(clipUrl(text), { method: 'HEAD' })
            .then((res): ClipProbe => (isAudioResponse(res) ? 'yes' : 'no'))
            .catch((): ClipProbe => 'unknown');
    probes.set(key, probe);
  }
  return probe;
}

/**
 * Plays the clip for `text` if it exists. Resolves true when playback started, false otherwise.
 * Each key is tried once: a failure (404, decode error, autoplay block) is remembered and not retried.
 */
export async function playStaticClip(text: string): Promise<boolean> {
  const key = clipKey(text);
  if (!key || missing.has(key) || typeof Audio === 'undefined') return false;
  try {
    // Only a probe that already ran counts: waiting for a new request here could lose the tap's autoplay permission (iOS).
    const known = probes.get(key);
    if (known && (await known) === 'no') {
      missing.add(key);
      return false;
    }
    let audio = loaded.get(key);
    if (!audio) {
      audio = new Audio(clipUrl(text));
      audio.preload = 'auto';
      loaded.set(key, audio);
    }
    audio.currentTime = 0;
    await audio.play();
    return true;
  } catch {
    missing.add(key);
    loaded.delete(key);
    return false;
  }
}
