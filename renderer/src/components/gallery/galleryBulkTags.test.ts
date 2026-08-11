import { beforeEach, describe, expect, it, vi } from 'vitest';

type StoredCard = { id: string; tagIds: string[] };

const cards = new Map<string, StoredCard>();

vi.mock('../../services/db', () => ({
  getCardById: async (cardId: string) => cards.get(cardId) ?? null,
  updateCardPayload: async (cardId: string, patch: { tagIds?: string[] }) => {
    const card = cards.get(cardId);
    if (!card || !patch.tagIds) return;
    cards.set(cardId, { ...card, tagIds: [...patch.tagIds] });
  },
  addCardToMoodboard: vi.fn(),
  permanentDeleteCard: vi.fn(),
  removeCardFromMoodboard: vi.fn(),
  restoreCard: vi.fn(),
  softDeleteCard: vi.fn()
}));

const {
  bulkAddTagToCards,
  bulkRemoveTagFromCards,
  bulkToggleTagForCards,
  resolveBulkTagState
} = await import('./galleryBulkActions');
const { undoTagAdd, undoTagRemove } = await import('./galleryUndoToast');

function seed(entries: StoredCard[]): void {
  cards.clear();
  for (const entry of entries) cards.set(entry.id, { ...entry, tagIds: [...entry.tagIds] });
}

function tagsOf(cardId: string): string[] {
  return cards.get(cardId)?.tagIds ?? [];
}

beforeEach(() => {
  seed([]);
});

describe('resolveBulkTagState', () => {
  const cardsById = new Map<string, { tagIds: string[] }>([
    ['a', { tagIds: ['t1'] }],
    ['b', { tagIds: ['t1', 't2'] }],
    ['c', { tagIds: [] }]
  ]);

  it('reports all when every selected card has the tag', () => {
    expect(resolveBulkTagState(['a', 'b'], cardsById, 't1')).toBe('all');
  });

  it('reports some when only part of the selection has the tag', () => {
    expect(resolveBulkTagState(['a', 'b', 'c'], cardsById, 't1')).toBe('some');
    expect(resolveBulkTagState(['a', 'b'], cardsById, 't2')).toBe('some');
  });

  it('reports none for an unused tag or an empty selection', () => {
    expect(resolveBulkTagState(['a', 'c'], cardsById, 't9')).toBe('none');
    expect(resolveBulkTagState([], cardsById, 't1')).toBe('none');
  });
});

describe('bulk tag mutations', () => {
  it('adds the tag only to cards missing it', async () => {
    seed([
      { id: 'a', tagIds: ['t1'] },
      { id: 'b', tagIds: [] }
    ]);

    const affected = await bulkAddTagToCards(['a', 'b'], 't1');

    expect(affected).toEqual(['b']);
    expect(tagsOf('a')).toEqual(['t1']);
    expect(tagsOf('b')).toEqual(['t1']);
  });

  it('removes the tag only from cards that have it and keeps the rest', async () => {
    seed([
      { id: 'a', tagIds: ['t1', 't2'] },
      { id: 'b', tagIds: ['t2'] }
    ]);

    const affected = await bulkRemoveTagFromCards(['a', 'b'], 't1');

    expect(affected).toEqual(['a']);
    expect(tagsOf('a')).toEqual(['t2']);
    expect(tagsOf('b')).toEqual(['t2']);
  });

  it('skips cards that no longer exist', async () => {
    seed([{ id: 'a', tagIds: [] }]);

    expect(await bulkAddTagToCards(['a', 'missing'], 't1')).toEqual(['a']);
  });

  it('toggles through the bulk entry point', async () => {
    seed([{ id: 'a', tagIds: [] }]);

    await bulkToggleTagForCards(['a'], 't1', true);
    expect(tagsOf('a')).toEqual(['t1']);

    await bulkToggleTagForCards(['a'], 't1', false);
    expect(tagsOf('a')).toEqual([]);
  });
});

describe('bulk tag undo', () => {
  it('restores the previous state after an add', async () => {
    seed([
      { id: 'a', tagIds: ['t1'] },
      { id: 'b', tagIds: [] }
    ]);

    const affected = await bulkAddTagToCards(['a', 'b'], 't1');
    await undoTagAdd(affected, 't1')();

    expect(tagsOf('a')).toEqual(['t1']);
    expect(tagsOf('b')).toEqual([]);
  });

  it('restores the previous state after a removal', async () => {
    seed([
      { id: 'a', tagIds: ['t1', 't2'] },
      { id: 'b', tagIds: ['t2'] }
    ]);

    const affected = await bulkRemoveTagFromCards(['a', 'b'], 't1');
    await undoTagRemove(affected, 't1')();

    expect(tagsOf('a')).toEqual(['t2', 't1']);
    expect(tagsOf('b')).toEqual(['t2']);
  });
});
