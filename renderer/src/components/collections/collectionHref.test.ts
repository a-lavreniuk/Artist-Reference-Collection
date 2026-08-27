import { describe, expect, it } from 'vitest';
import { collectionHref } from './collectionHref';

describe('collectionHref', () => {
  it('opens a root collection by id', () => {
    expect(collectionHref({ id: 'c1' })).toBe('/collections/c1');
  });

  it('opens a section under its parent', () => {
    expect(collectionHref({ id: 's1', parentId: 'c1' })).toBe('/collections/c1/sections/s1');
  });
});
