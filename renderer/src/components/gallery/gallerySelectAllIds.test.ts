import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_GALLERY_SORT, emptyGalleryAdvancedFilters } from './galleryFilterTypes';
import type { GalleryFeedQuery } from './galleryQuery';

const PAGE_SIZE = 500;
const listCardsPage = vi.fn();

vi.mock('../../services/db', () => ({
  LIST_CARDS_PAGE_SIZE: 500,
  listCardsPage: (params: unknown) => listCardsPage(params)
}));

const { listAllCardIdsForQuery } = await import('./gallerySelectAllIds');

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

function page(count: number, offset: number): Array<{ id: string }> {
  return Array.from({ length: count }, (_, i) => ({ id: `card-${offset + i}` }));
}

describe('listAllCardIdsForQuery', () => {
  it('returns ids of a single short page', async () => {
    listCardsPage.mockReset();
    listCardsPage.mockResolvedValueOnce(page(3, 0));
    const ids = await listAllCardIdsForQuery(query({ collectionId: 'col-1' }));
    expect(ids).toEqual(['card-0', 'card-1', 'card-2']);
    expect(listCardsPage).toHaveBeenCalledTimes(1);
    expect(listCardsPage.mock.calls[0][0]).toMatchObject({
      offset: 0,
      limit: PAGE_SIZE,
      collectionId: 'col-1'
    });
  });

  it('pages until a partial chunk arrives', async () => {
    listCardsPage.mockReset();
    listCardsPage
      .mockResolvedValueOnce(page(PAGE_SIZE, 0))
      .mockResolvedValueOnce(page(2, PAGE_SIZE));
    const ids = await listAllCardIdsForQuery(query());
    expect(ids).toHaveLength(PAGE_SIZE + 2);
    expect(listCardsPage).toHaveBeenCalledTimes(2);
    expect(listCardsPage.mock.calls[1][0]).toMatchObject({ offset: PAGE_SIZE });
  });

  it('passes the moodboard filter through', async () => {
    listCardsPage.mockReset();
    listCardsPage.mockResolvedValueOnce([]);
    await listAllCardIdsForQuery(query({ moodboardCardIds: ['a', 'b'] }));
    expect(listCardsPage.mock.calls[0][0]).toMatchObject({ moodboardCardIds: ['a', 'b'] });
  });
});
