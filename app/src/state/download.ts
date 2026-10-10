import { getProgressSnapshot } from './progressStore';
import { localDateString } from './streak';
import { serializeProgress } from './persistence';

/** Saves the current progress as a JSON file through a temporary download link. */
export function downloadProgress(): void {
  const blob = new Blob([serializeProgress(getProgressSnapshot())], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `nihongo-dojo-progreso-${localDateString(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
