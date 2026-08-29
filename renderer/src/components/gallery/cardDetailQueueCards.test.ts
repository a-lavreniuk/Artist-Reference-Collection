import { describe, expect, it, vi, beforeEach } from 'vitest';

const listCardsPage = vi.fn();

vi.mock('../../services/db', () => ({
  listCardsPage: (params: unknown) => listCardsPage(params)
}));

const { loadCardsInOrder, sliceIdsAround } = await import('./cardDetailQueueCards');

describe('loadCardsInOrder', () => {
  beforeEach(() => {
    listCardsPage.mockReset();
  });

  it('returns cards in the requested id order', async () => {
    listCardsPage.mockResolvedValueOnce([
      { id: 'c' },
      { id: 'a' },
      { id: 'b' }
    ]);
    await expect(loadCardsInOrder(['a', 'b', 'c'])).resolves.toEqual([
      { id: 'a' },
      { id: 'b' },
      { id: 'c' }
    ]);
  });

  it('returns an empty list for no ids', async () => {
    await expect(loadCardsInOrder([])).resolves.toEqual([]);
    expect(listCardsPage).not.toHaveBeenCalled();
  });
});

describe('sliceIdsAround', () => {
  it('returns a window around the active id', () => {
    expect(sliceIdsAround(['a', 'b', 'c', 'd', 'e'], 'c', 1)).toEqual(['b', 'c', 'd']);
  });

  it('clamps to edges', () => {
    expect(sliceIdsAround(['a', 'b', 'c'], 'a', 2)).toEqual(['a', 'b', 'c']);
  });
});
