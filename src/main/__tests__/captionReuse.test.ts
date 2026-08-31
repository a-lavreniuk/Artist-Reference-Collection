import { describe, expect, it } from 'vitest';

import { shouldRegenerateSearchCaption } from '../ai/captionReuse';

describe('shouldRegenerateSearchCaption', () => {
  it('reuses a saved caption during idle indexing', () => {
    expect(shouldRegenerateSearchCaption('На изображении закат.', false)).toBe(false);
  });

  it('writes a caption when the card has none yet', () => {
    expect(shouldRegenerateSearchCaption(null, false)).toBe(true);
    expect(shouldRegenerateSearchCaption('   ', false)).toBe(true);
  });

  it('rewrites captions only on an explicit full reindex', () => {
    expect(shouldRegenerateSearchCaption('На изображении закат.', true)).toBe(true);
  });
});
