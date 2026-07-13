import { describe, expect, it } from 'vitest';

import { formatScreenshotName, sanitizeWindowTitle } from '../screenshotCapture';

describe('formatScreenshotName', () => {
  it('formats datetime with seconds', () => {
    const name = formatScreenshotName();
    expect(name).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('appends sanitized window title', () => {
    const name = formatScreenshotName('  Notepad  ');
    expect(name).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} Notepad$/);
  });
});

describe('sanitizeWindowTitle', () => {
  it('removes illegal filename characters', () => {
    expect(sanitizeWindowTitle('foo<bar>:baz')).toBe('foobarbaz');
  });
});
