import { create } from 'zustand';
import { t, translate } from '../i18n';
import { ProgressSchema, STORAGE_KEY, migrate, type Lang, type Progress } from './progressSchema';

/** Interface language, or the browser's while the store is still being created (the first load happens before it exists). */
function currentT(key: string, vars?: Record<string, string | number>): string {
  try {
    return t(key, vars);
  } catch {
    const lang: Lang = typeof navigator !== 'undefined' && /^en/i.test(navigator.language) ? 'en' : 'es';
    return translate(lang, key, vars);
  }
}

/** Set when saved progress existed but could not be used (shown once as a banner). */
export const loadIssue: { message: string | null } = { message: null };

export type ParseResult = { ok: true; progress: Progress } | { ok: false; error: string };

export function parseProgress(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: currentT('settings.errJson') };
  }
  const migrated = migrate(json);
  if (!migrated.ok) return { ok: false, error: migrated.i18n ? currentT(migrated.i18n.key, migrated.i18n.vars) : migrated.error };
  const result = ProgressSchema.safeParse(migrated.json);
  if (!result.success) {
    const issue = result.error.issues[0];
    return { ok: false, error: currentT('settings.errInvalid', { where: issue?.path.join('.') || currentT('settings.errRoot'), message: issue?.message ?? '' }) };
  }
  return { ok: true, progress: result.data };
}

/** Reads saved progress; returns null when absent, unreadable or invalid. */
export function loadProgress(): Progress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = parseProgress(raw);
    if (!parsed.ok) {
      console.warn(`[progress] se ignora el progreso guardado: ${parsed.error}`);
      loadIssue.message = currentT('settings.errCorrupt', { error: parsed.error });
      try {
        localStorage.setItem(`${STORAGE_KEY}:corrupto`, raw);
      } catch {
        /* nothing more to do */
      }
    }
    return parsed.ok ? parsed.progress : null;
  } catch (error) {
    console.warn('[progress] localStorage no disponible', error);
    return null;
  }
}

let persistRequested = false;

/** Asks the browser not to evict our storage under pressure; best effort, once per session. */
function requestPersistentStorage(): void {
  if (persistRequested) return;
  persistRequested = true;
  try {
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    /* unsupported */
  }
}

/** Whether the last attempt to save the progress failed (quota full, private mode…); the Layout shows a banner. */
export const useSaveStatus = create<{ failed: boolean }>()(() => ({ failed: false }));

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    requestPersistentStorage();
    if (useSaveStatus.getState().failed) useSaveStatus.setState({ failed: false });
  } catch (error) {
    console.warn('[progress] no se pudo guardar el progreso', error);
    if (!useSaveStatus.getState().failed) useSaveStatus.setState({ failed: true });
  }
}

export function serializeProgress(progress: Progress): string {
  return JSON.stringify(progress, null, 2);
}
