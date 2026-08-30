import { describe, expect, it } from 'vitest';

import { shouldKeepSharedCaptionFiles } from '../ai/captionShare';

describe('shouldKeepSharedCaptionFiles', () => {
  it('keeps JoyCaption on disk when Qwen is still installed after auto-tag delete', () => {
    expect(shouldKeepSharedCaptionFiles(true, false)).toBe(true);
  });

  it('keeps JoyCaption when auto-tags stay after Qwen delete', () => {
    expect(shouldKeepSharedCaptionFiles(false, true)).toBe(true);
  });

  it('allows delete only when nobody else needs the files', () => {
    expect(shouldKeepSharedCaptionFiles(false, false)).toBe(false);
  });
});
