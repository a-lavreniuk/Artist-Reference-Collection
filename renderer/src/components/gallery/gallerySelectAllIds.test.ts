import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_GALLERY_SORT, emptyGalleryAdvancedFilters } from './galleryFilterTypes';
import type { GalleryFeedQuery } from './galleryQuery';

const listCardIdsPage = vi.fn();

vi.mock('../../services/db', () => ({
  listCardIdsPage: (params: unknown) => listCardIdsPage(params)
}));

const { listAllCardIdsForQuery, listCardIdsAroundForQuery, SELECT_ALL_IDS_CAP } = await import(
  './gallerySelectAllIds'
);

function query(overrides: Partial<GalleryFeedQuery> = {}): GalleryFeedQuery {
  return {
    libraryScope: 'all',
    selectedTagIds: [],
    cardIdExact: null,
    advancedFilters: emptyGalleryAdvancedFilters(),
    sort: DEFAULT_GALLERY_SORT,
    ...overrides
  };
}

describe('listAllCardIdsForQuery', () => {
  it('requests a single id-only page up to the cap', async () => {
    listCardIdsPage.mockReset();
    listCardIdsPage.mockResolvedValueOnce(['card-0', 'card-1', 'card-2']);
    const ids = await listAllCardIdsForQuery(query({ collectionId: 'col-1' }));
    expect(ids).toEqual(['card-0', 'card-1', 'card-2']);
    expect(listCardIdsPage).toHaveBeenCalledTimes(1);
    expect(listCardIdsPage.mock.calls[0][0]).toMatchObject({
      offset: 0,
      limit: SELECT_ALL_IDS_CAP,
      collectionId: 'col-1'
    });
  });

  it('passes the moodboard filter through', async () => {
    listCardIdsPage.mockReset();
    listCardIdsPage.mockResolvedValueOnce([]);
    await listAllCardIdsForQuery(query({ moodboardCardIds: ['a', 'b'] }));
    expect(listCardIdsPage.mock.calls[0][0]).toMatchObject({ moodboardCardIds: ['a', 'b'] });
  });
});

describe('listCardIdsAroundForQuery', () => {
  it('asks storage for a window around the open card', async () => {
    listCardIdsPage.mockReset();
    listCardIdsPage.mockResolvedValueOnce(['b', 'c', 'd']);
    const ids = await listCardIdsAroundForQuery(query({ collectionId: 'col-1' }), 'c', 1);
    expect(ids).toEqual(['b', 'c', 'd']);
    expect(listCardIdsPage.mock.calls[0][0]).toMatchObject({
      collectionId: 'col-1',
      aroundCardId: 'c',
      radius: 1
    });
  });
});
