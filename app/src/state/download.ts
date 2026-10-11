import { getProgressSnapshot } from './progressStore';
import { localDateString } from './streak';
import { serializeProgress } from './persistence';

/** Backup file name, e.g. `nihongo_dojo_backup_2026-10-11.json` (local date). */
export function backupFilename(date: Date): string {
  return `nihongo_dojo_backup_${localDateString(date)}.json`;
}

/**
 * Saves the current progress as a JSON file through a temporary download link. The link is attached to the DOM
 * for the click and the blob URL is revoked later, which iOS Safari and old Firefox need (QA-047).
 */
export function downloadProgress(): void {
  const blob = new Blob([serializeProgress(getProgressSnapshot())], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = backupFilename(new Date());
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
