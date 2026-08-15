import { describe, expect, it, vi, beforeEach } from 'vitest';

const listCardsPage = vi.fn();

vi.mock('../../services/db', () => ({
  listCardsPage: (params: unknown) => listCardsPage(params)
}));

const { loadCardsInOrder } = await import('./cardDetailQueueCards');

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
