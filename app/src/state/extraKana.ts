import { createContext } from 'react';

const NONE: readonly string[] = [];

/**
 * Kana treated as known on top of `progress.knownKana` for the subtree below the provider.
 * A lesson in progress provides its new kana so JaText shows them as kana while practising,
 * before the lesson is completed and they are unlocked for good.
 */
export const ExtraKanaContext = createContext<readonly string[]>(NONE);
