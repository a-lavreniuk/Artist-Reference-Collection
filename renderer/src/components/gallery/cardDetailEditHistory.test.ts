import { describe, expect, it } from 'vitest';
import {
  applyPatchToCommitted,
  createCardDetailEditHistory,
  diffAgainstCommitted,
  EMPTY_CARD_DETAIL_COMMITTED,
  patchesEqual
} from './cardDetailEditHistory';

describe('cardDetailEditHistory', () => {
  it('undoes and redoes the last saved patch', () => {
    const history = createCardDetailEditHistory();
    history.push({
      cardId: 'card-1',
      before: { name: 'A' },
      after: { name: 'B' }
    });

    const undone = history.undo();
    expect(undone?.before.name).toBe('A');
    expect(history.undo()).toBeNull();

    const redone = history.redo();
    expect(redone?.after.name).toBe('B');
    expect(history.redo()).toBeNull();
  });

  it('clears redo after a new change', () => {
    const history = createCardDetailEditHistory();
    history.push({ cardId: 'card-1', before: { rating: 0 }, after: { rating: 3 } });
    history.undo();
    history.push({ cardId: 'card-1', before: { rating: 0 }, after: { rating: 5 } });

    expect(history.redo()).toBeNull();
    expect(history.undo()?.after.rating).toBe(5);
  });

  it('skips identical patches and clones stored maps', () => {
    const history = createCardDetailEditHistory();
    history.push({
      cardId: 'card-1',
      before: { name: 'Same' },
      after: { name: 'Same' }
    });
    expect(history.undo()).toBeNull();

    const customFields = { color: 'red' };
    history.push({
      cardId: 'card-1',
      before: { customFields: {} },
      after: { customFields }
    });
    customFields.color = 'blue';
    expect(history.undo()?.after.customFields).toEqual({ color: 'red' });
  });

  it('diffs only changed keys against committed state', () => {
    const committed = {
      ...EMPTY_CARD_DETAIL_COMMITTED,
      name: 'Old',
      rating: 1
    };
    expect(diffAgainstCommitted(committed, { name: 'Old', rating: 1 })).toBeNull();

    const diff = diffAgainstCommitted(committed, { name: 'New', rating: 1 });
    expect(diff).toEqual({ before: { name: 'Old' }, after: { name: 'New' } });
    expect(
      applyPatchToCommitted(committed, diff!.after)
    ).toMatchObject({ name: 'New', rating: 1 });
    expect(patchesEqual({ name: 'A' }, { name: 'A' })).toBe(true);
  });

  it('drops the oldest entries when the stack is full', () => {
    const history = createCardDetailEditHistory(2);
    history.push({ cardId: 'card-1', before: { rating: 0 }, after: { rating: 1 } });
    history.push({ cardId: 'card-1', before: { rating: 1 }, after: { rating: 2 } });
    history.push({ cardId: 'card-1', before: { rating: 2 }, after: { rating: 3 } });

    expect(history.undo()?.after.rating).toBe(3);
    expect(history.undo()?.after.rating).toBe(2);
    expect(history.undo()).toBeNull();
  });
});
