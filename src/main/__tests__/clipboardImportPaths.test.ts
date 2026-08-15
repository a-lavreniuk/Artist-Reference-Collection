import path from 'path';
import { describe, expect, it } from 'vitest';
import { clipboardImportTempDir, isClipboardImportTempPath } from '../clipboardImportPaths';

describe('clipboardImportPaths', () => {
  it('accepts a png inside the temp dir', () => {
    const ok = path.join(clipboardImportTempDir(), 'arc-paste-test.png');
    expect(isClipboardImportTempPath(ok)).toBe(true);
  });

  it('rejects paths outside the temp dir and non-png', () => {
    const dir = clipboardImportTempDir();
    expect(isClipboardImportTempPath(path.join(dir, '..', 'escape.png'))).toBe(false);
    expect(isClipboardImportTempPath(path.join(dir, 'note.txt'))).toBe(false);
    expect(isClipboardImportTempPath('')).toBe(false);
  });
});
