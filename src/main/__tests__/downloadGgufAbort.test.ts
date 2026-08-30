import { describe, expect, it } from 'vitest';

import { isDownloadAbortError } from '../ai/downloadGguf';

describe('isDownloadAbortError', () => {
  it('maps AbortError and cancel messages to a cancelled download', () => {
    expect(isDownloadAbortError(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }))).toBe(
      true
    );
    expect(isDownloadAbortError(new Error('The operation was aborted'))).toBe(true);
    expect(isDownloadAbortError(new Error('Загрузка отменена'))).toBe(true);
    expect(isDownloadAbortError(new Error('HTTP 404'))).toBe(false);
  });
});
