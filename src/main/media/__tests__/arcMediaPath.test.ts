import { describe, expect, it } from 'vitest';

import { LIBRARY_CARD_MEDIA_REL, resolveMediaAbsFromParams } from '../arcMediaPath';

describe('LIBRARY_CARD_MEDIA_REL', () => {
  it('matches original and Meta thumbs, plus legacy thumbs', () => {
    expect(LIBRARY_CARD_MEDIA_REL.test('cards/abc/original.jpg')).toBe(true);
    expect(LIBRARY_CARD_MEDIA_REL.test('cards/abc/Meta/thumb_s.webp')).toBe(true);
    expect(LIBRARY_CARD_MEDIA_REL.test('cards/abc/Meta/thumb_m.webp')).toBe(true);
    expect(LIBRARY_CARD_MEDIA_REL.test('cards/abc/Meta/thumb_l.webp')).toBe(true);
    expect(LIBRARY_CARD_MEDIA_REL.test('cards/abc/thumb_s.webp')).toBe(true);
    expect(LIBRARY_CARD_MEDIA_REL.test('cards/abc/Meta/card.json')).toBe(false);
    expect(LIBRARY_CARD_MEDIA_REL.test('cards/abc/Meta/frames/frame-0.png')).toBe(false);
  });
});

describe('resolveMediaAbsFromParams', () => {
  const libraryRoot = 'C:\\Library';
  const staging = new Map<string, { absPath: string; expiresAt: number }>([
    ['tok1', { absPath: 'C:\\Temp\\preview.jpg', expiresAt: Date.now() + 60_000 }]
  ]);

  it('resolves library rel paths inside root', () => {
    const abs = resolveMediaAbsFromParams(
      libraryRoot,
      'cards/abc/Meta/thumb_s.webp',
      null,
      staging
    );
    expect(abs).toBeTruthy();
    expect(abs!.replace(/\\/g, '/')).toContain('cards/abc/Meta/thumb_s.webp');
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
      'cards/xyz/Meta/thumb_s.webp',
      null,
      staging,
      { libraryId: 'lib-b', rootsByLibraryId: roots }
    );
    expect(abs).toBeTruthy();
    expect(abs!.replace(/\\/g, '/')).toContain('LibB/cards/xyz/Meta/thumb_s.webp');
  });

  it('rejects unknown library id in lib param', () => {
    const roots = new Map([['lib-a', 'C:\\LibA']]);
    expect(
      resolveMediaAbsFromParams('C:\\LibA', 'cards/xyz/Meta/thumb_s.webp', null, staging, {
        libraryId: 'missing',
        rootsByLibraryId: roots
      })
    ).toBeNull();
  });
});
