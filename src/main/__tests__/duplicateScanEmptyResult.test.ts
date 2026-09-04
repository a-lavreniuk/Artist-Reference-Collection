import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: { handle: () => undefined }
}));

import { duplicateScanEmptyResult } from '../ipcDuplicates';

describe('duplicateScanEmptyResult', () => {
  it('marks a concurrent scan as busy instead of a finished empty search', () => {
    expect(duplicateScanEmptyResult({ busy: true })).toMatchObject({
      pairs: [],
      cancelled: false,
      busy: true
    });
  });
});
