import path from 'path';
import { describe, expect, it } from 'vitest';

import { resolveZipEntryAbs } from '../zipRead';

describe('resolveZipEntryAbs', () => {
  const dest = path.win32.join('C:\\', 'Restore', 'Lib');

  it('принимает обычные относительные пути', () => {
    const abs = resolveZipEntryAbs(dest, 'meta/arc-index.db');
    expect(abs.replace(/\\/g, '/').toLowerCase()).toContain('restore/lib/meta/arc-index.db');
  });

  it('отклоняет Zip Slip с ..', () => {
    expect(() => resolveZipEntryAbs(dest, '../../../payload.exe')).toThrow(/Небезопасный путь/);
    expect(() => resolveZipEntryAbs(dest, 'meta/../../outside.txt')).toThrow(/Небезопасный путь/);
  });

  it('отклоняет абсолютные пути в имени записи', () => {
    expect(() => resolveZipEntryAbs(dest, '/etc/passwd')).toThrow(/Небезопасный путь/);
    expect(() => resolveZipEntryAbs(dest, 'D:/evil.exe')).toThrow(/Небезопасный путь/);
  });
});
