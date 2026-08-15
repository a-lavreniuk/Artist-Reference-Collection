import { describe, expect, it } from 'vitest';

import { resolveMediaAbsFromParams } from '../arcMediaPath';

describe('resolveMediaAbsFromParams', () => {
  const libraryRoot = 'C:\\Library';
  const staging = new Map<string, { absPath: string; expiresAt: number }>([
    ['tok1', { absPath: 'C:\\Temp\\preview.jpg', expiresAt: Date.now() + 60_000 }]
  ]);

  it('resolves library rel paths inside root', () => {
    const abs = resolveMediaAbsFromParams(
      libraryRoot,
      'cards/abc/thumb_s.jpg',
      null,
      staging
    );
    expect(abs).toBeTruthy();
    expect(abs!.replace(/\\/g, '/')).toContain('cards/abc/thumb_s.jpg');
  });

  it('resolves staging token instead of raw abs', () => {
    const abs = resolveMediaAbsFromParams(libraryRoot, null, 'tok1', staging);
    expect(abs).toBe('C:\\Temp\\preview.jpg');
  });

  it('rejects unknown staging token', () => {
    expect(resolveMediaAbsFromParams(libraryRoot, null, 'missing', staging)).toBeNull();
  });

  it('resolves rel against a mapped sibling library when lib is set', () => {
    const roots = new Map([
      ['lib-a', 'C:\\LibA'],
      ['lib-b', 'C:\\LibB']
    ]);
    const abs = resolveMediaAbsFromParams(
      'C:\\LibA',
      'cards/xyz/thumb_s.jpg',
      null,
      staging,
      { libraryId: 'lib-b', rootsByLibraryId: roots }
    );
    expect(abs).toBeTruthy();
    expect(abs!.replace(/\\/g, '/')).toContain('LibB/cards/xyz/thumb_s.jpg');
  });

  it('rejects unknown library id in lib param', () => {
    const roots = new Map([['lib-a', 'C:\\LibA']]);
    expect(
      resolveMediaAbsFromParams('C:\\LibA', 'cards/xyz/thumb_s.jpg', null, staging, {
        libraryId: 'missing',
        rootsByLibraryId: roots
      })
    ).toBeNull();
  });
});
