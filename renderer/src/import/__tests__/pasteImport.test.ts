import { describe, expect, it } from 'vitest';
import { collectionIdFromPathname, droppedPathsFromClipboard } from '../pasteImport';

describe('collectionIdFromPathname', () => {
  it('reads id from a collection screen', () => {
    expect(collectionIdFromPathname('/collections/abc-123')).toBe('abc-123');
  });

  it('returns null outside a collection screen', () => {
    expect(collectionIdFromPathname('/collections')).toBeNull();
    expect(collectionIdFromPathname('/gallery')).toBeNull();
    expect(collectionIdFromPathname('/')).toBeNull();
  });
});

describe('droppedPathsFromClipboard', () => {
  it('returns empty when getter is missing or throws', () => {
    expect(droppedPathsFromClipboard(undefined, {} as DataTransfer)).toEqual([]);
    expect(
      droppedPathsFromClipboard(() => {
        throw new Error("Cannot read properties of undefined (reading 'length')");
      }, {} as DataTransfer)
    ).toEqual([]);
  });

  it('ignores a non-array result', () => {
    expect(droppedPathsFromClipboard(() => undefined as unknown as string[], {} as DataTransfer)).toEqual(
      []
    );
  });
});
