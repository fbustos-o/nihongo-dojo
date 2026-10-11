/**
 * Static audio fallback: clips served from `${BASE_URL}audio/<key>.mp3`.
 * Key scheme: NFKC-normalize the text, drop whitespace and punctuation/symbols (Unicode P*, S*), keep
 * kana/kanji as they are. "ありがとう。" -> "ありがとう"; the URL path is percent-encoded.
 * Available clips are listed in `${BASE_URL}audio/manifest.json` (`{ "clips": ["ありがとう", …] }`), fetched once,
 * so missing clips never cost a request (no 404 noise in the console).
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
let manifest: Promise<ReadonlySet<string> | null> | null = null;
/** The manifest once it has arrived; `undefined` while pending. */
let manifestKeys: ReadonlySet<string> | null | undefined;

/** `unknown`: the request itself failed (offline, no fetch), so the clip may still exist. */
export type ClipProbe = 'yes' | 'no' | 'unknown';

/** Test helper. */
export function resetStaticAudioCache(): void {
  missing.clear();
  loaded.clear();
  probes.clear();
  manifest = null;
  manifestKeys = undefined;
}

/** The set of available clip keys; empty if there is no manifest, `null` if it couldn't be fetched (offline). */
function loadManifest(): Promise<ReadonlySet<string> | null> {
  if (!manifest) {
    manifest =
      typeof fetch !== 'function'
        ? Promise.resolve(null)
        : fetch(`${import.meta.env.BASE_URL}audio/manifest.json`)
            .then(async (res) => {
              if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return new Set<string>();
              const data = (await res.json()) as { clips?: unknown };
              return new Set(Array.isArray(data.clips) ? data.clips.filter((k): k is string => typeof k === 'string').map(clipKey) : []);
            })
            .catch(() => null)
            .then((keys) => (manifestKeys = keys));
  }
  return manifest;
}

/** Starts fetching the manifest early so `playStaticClip` can decide synchronously inside a tap. */
export function preloadStaticClips(): Promise<unknown> {
  return loadManifest();
}

/** Whether a clip exists for `text`, answered from the manifest (QA-046). */
export function probeStaticClip(text: string): Promise<ClipProbe> {
  const key = clipKey(text);
  if (!key) return Promise.resolve('no');
  if (missing.has(key)) return Promise.resolve('no');
  let probe = probes.get(key);
  if (!probe) {
    probe = loadManifest().then((keys): ClipProbe => (keys === null ? 'unknown' : keys.has(key) ? 'yes' : 'no'));
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
    // Decide from the manifest only if it has already arrived: waiting for a request here could lose the tap's
    // autoplay permission (iOS). Unknown or absent from the manifest means no request at all (no 404 noise).
    if (manifestKeys === undefined) {
      void preloadStaticClips();
      return false;
    }
    if (manifestKeys !== null && !manifestKeys.has(key)) {
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
