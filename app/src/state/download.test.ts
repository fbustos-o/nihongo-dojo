import { describe, expect, it, vi } from 'vitest';
import { backupFilename, downloadProgress } from './download';

describe('backup download', () => {
  it('names the file with the local date', () => {
    expect(backupFilename(new Date(2026, 0, 5, 23, 59))).toBe('nihongo_dojo_backup_2026-01-05.json');
    expect(backupFilename(new Date(2026, 11, 31, 0, 1))).toBe('nihongo_dojo_backup_2026-12-31.json');
  });

  it('triggers a download with that name', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 11, 12));
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    let name = '';
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      name = this.download;
    });
    downloadProgress();
    expect(click).toHaveBeenCalled();
    expect(name).toBe('nihongo_dojo_backup_2026-10-11.json');
    vi.useRealTimers();
    click.mockRestore();
  });
});
