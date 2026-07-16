import path from 'path';
import { describe, expect, it } from 'vitest';

import { isFilesystemRoot } from '../zipStore';

describe('isFilesystemRoot', () => {
  it('распознаёт корень диска Windows', () => {
    expect(isFilesystemRoot('D:\\', path.win32)).toBe(true);
    expect(isFilesystemRoot('D:/', path.win32)).toBe(true);
    expect(isFilesystemRoot('C:\\', path.win32)).toBe(true);
  });

  it('не считает обычную папку корнем', () => {
    expect(isFilesystemRoot('D:\\Backups', path.win32)).toBe(false);
    expect(isFilesystemRoot('D:\\Backups\\ARC', path.win32)).toBe(false);
  });

  it('распознаёт корень POSIX', () => {
    expect(isFilesystemRoot('/', path.posix)).toBe(true);
    expect(isFilesystemRoot('/tmp', path.posix)).toBe(false);
  });
});
