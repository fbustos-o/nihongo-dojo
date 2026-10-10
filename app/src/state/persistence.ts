import { ProgressSchema, STORAGE_KEY, type Progress } from './progressSchema';

export type ParseResult = { ok: true; progress: Progress } | { ok: false; error: string };

export function parseProgress(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'El archivo no es un JSON válido.' };
  }
  const result = ProgressSchema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    return { ok: false, error: `Progreso inválido (${issue?.path.join('.') || 'raíz'}: ${issue?.message}).` };
  }
  return { ok: true, progress: result.data };
}

/** Reads saved progress; returns null when absent, unreadable or invalid. */
export function loadProgress(): Progress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = parseProgress(raw);
    if (!parsed.ok) console.warn(`[progress] se ignora el progreso guardado: ${parsed.error}`);
    return parsed.ok ? parsed.progress : null;
  } catch (error) {
    console.warn('[progress] localStorage no disponible', error);
    return null;
  }
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    console.warn('[progress] no se pudo guardar el progreso', error);
  }
}

export function serializeProgress(progress: Progress): string {
  return JSON.stringify(progress, null, 2);
}
