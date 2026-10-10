import { createContext } from 'react';

const NONE: readonly string[] = [];

/**
 * Kana treated as known on top of `progress.knownKana` for the subtree below the provider.
 * A lesson in progress provides its new kana so JaText shows them as kana while practising,
 * before the lesson is completed and they are unlocked for good.
 */
export const ExtraKanaContext = createContext<readonly string[]>(NONE);

const NO_KANJI: readonly string[] = [];

/**
 * Kanji treated as unlocked (furigana shown) on top of `progress.unlockedKanji` below the provider:
 * a kanji lesson in progress provides its new kanji so JaText shows them while practising, before the
 * lesson is completed and they are unlocked for good.
 */
export const ExtraKanjiContext = createContext<readonly string[]>(NO_KANJI);
