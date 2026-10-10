import type { ZodType } from 'zod';

/** Problems found while loading the content files (invalid or missing entries); shown as a banner. */
export const contentIssues: string[] = [];

/**
 * Validates a JSON list item by item: valid entries are kept, invalid ones are
 * dropped with a console warning. A missing file or a non-array yields [].
 */
export function parseList<T>(file: string, schema: ZodType<T>, raw: unknown): T[] {
  if (raw === undefined) {
    contentIssues.push(`${file}: falta el archivo.`);
    return [];
  }
  if (!Array.isArray(raw)) {
    console.warn(`[content] ${file}: se esperaba un arreglo; se ignora el archivo.`);
    contentIssues.push(`${file}: formato inválido.`);
    return [];
  }
  const valid: T[] = [];
  let firstError: string | undefined;
  let invalid = 0;
  for (const [index, item] of raw.entries()) {
    const result = schema.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalid += 1;
      firstError ??= `#${index}: ${result.error.issues[0]?.path.join('.')} ${result.error.issues[0]?.message}`;
    }
  }
  if (invalid > 0) {
    contentIssues.push(`${file}: ${invalid} entradas inválidas descartadas.`);
    console.warn(`[content] ${file}: ${invalid} entradas inválidas descartadas (primera ${firstError}).`);
  }
  return valid;
}
