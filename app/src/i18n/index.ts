import { useCallback } from 'react';
import type { Lang } from '../state/progressSchema';
import { useProgress } from '../state/progressStore';
import { MESSAGES, type MessageKey } from './messages';

export type { MessageKey };
export type Vars = Record<string, string | number>;

/** Interface language from settings (Spanish by default). */
export const getLang = (): Lang => useProgress.getState().settings.uiLang;

/** Language of meanings / translations (independent setting). */
export const getMeaningLang = (): Lang => useProgress.getState().settings.meaningLang;

/** Looks a key up in `lang`, then in Spanish, then returns the key itself (never throws; a test guards the dictionaries). */
export function translate(lang: Lang, key: MessageKey | string, vars?: Vars): string {
  const raw = MESSAGES[lang][key] ?? MESSAGES.es[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

/** Non-hook access (store actions, celebrations, labels built outside React). */
export const t = (key: MessageKey | string, vars?: Vars): string => translate(getLang(), key, vars);

/** Reactive interface language. */
export const useLang = (): Lang => useProgress((s) => s.settings.uiLang);

/** Reactive meaning language (for `glosses`, dialogue lines, pattern explanations). */
export const useMeaningLang = (): Lang => useProgress((s) => s.settings.meaningLang);

/** `const t = useT(); t('nav.home')` — re-renders when the interface language changes. */
export function useT(): (key: MessageKey | string, vars?: Vars) => string {
  const lang = useLang();
  return useCallback((key: MessageKey | string, vars?: Vars) => translate(lang, key, vars), [lang]);
}

/** BCP 47 tag for `<html lang>` and Intl formatting. */
export const localeOf = (lang: Lang): string => (lang === 'en' ? 'en' : 'es');
