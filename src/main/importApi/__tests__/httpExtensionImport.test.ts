import { describe, expect, it } from 'vitest';

import { mediaOptionsForHttpExtensionImport } from '../httpExtensionImport';

describe('mediaOptionsForHttpExtensionImport', () => {
  it('never writes name or linkUrl, even if the extension sends them', () => {
    expect(
      mediaOptionsForHttpExtensionImport({
        name: 'Pin title',
        website: 'https://example.com/page'
      })
    ).toEqual({});
  });
});
