import { describe, expect, it } from 'vitest';
import { ARC_LIBRARY_SCOPE_PARAM } from '../libraryScopeUrl';
import { ARC_SEARCH_QUERY_AI, ARC_SEARCH_QUERY_TAG } from '../searchUrl';
import { clearGallerySearchParams, resetGalleryToDefaultLibraryParams } from '../clearGallerySearch';

describe('clearGallerySearchParams', () => {
  it('clears search params and keeps library scope', () => {
    const prev = new URLSearchParams();
    prev.append(ARC_SEARCH_QUERY_TAG, 'tag-a');
    prev.set(ARC_SEARCH_QUERY_AI, 'sunset');
    prev.set(ARC_LIBRARY_SCOPE_PARAM, 'trash');
    prev.set('detail', 'card-1');

    const next = clearGallerySearchParams(prev);

    expect(next.getAll(ARC_SEARCH_QUERY_TAG)).toEqual([]);
    expect(next.get(ARC_SEARCH_QUERY_AI)).toBeNull();
    expect(next.get(ARC_LIBRARY_SCOPE_PARAM)).toBe('trash');
    expect(next.get('detail')).toBe('card-1');
  });
});

describe('resetGalleryToDefaultLibraryParams', () => {
  it('clears search params and removes trash / untagged library scope', () => {
    const prev = new URLSearchParams();
    prev.append(ARC_SEARCH_QUERY_TAG, 'tag-a');
    prev.set(ARC_LIBRARY_SCOPE_PARAM, 'trash');
    prev.set('detail', 'card-1');

    const next = resetGalleryToDefaultLibraryParams(prev);

    expect(next.getAll(ARC_SEARCH_QUERY_TAG)).toEqual([]);
    expect(next.get(ARC_LIBRARY_SCOPE_PARAM)).toBeNull();
    expect(next.get('detail')).toBe('card-1');
  });

  it('removes legacy lib=untagged', () => {
    const prev = new URLSearchParams();
    prev.set(ARC_LIBRARY_SCOPE_PARAM, 'untagged');

    const next = resetGalleryToDefaultLibraryParams(prev);

    expect(next.get(ARC_LIBRARY_SCOPE_PARAM)).toBeNull();
  });
});
