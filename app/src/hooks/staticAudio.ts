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

/** Test helper. */
export function resetStaticAudioCache(): void {
  missing.clear();
  loaded.clear();
}

/**
 * Plays the clip for `text` if it exists. Resolves true when playback started, false otherwise.
 * Each key is tried once: a failure (404, decode error, autoplay block) is remembered and not retried.
 */
export async function playStaticClip(text: string): Promise<boolean> {
  const key = clipKey(text);
  if (!key || missing.has(key) || typeof Audio === 'undefined') return false;
  try {
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
