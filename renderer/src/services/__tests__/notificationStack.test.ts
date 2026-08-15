import { describe, expect, it } from 'vitest';
import { upsertNotificationStack } from '../notificationService';

describe('upsertNotificationStack', () => {
  it('appends a toast with a new id', () => {
    const { next, droppedActionId } = upsertNotificationStack([{ id: 'a' }], { id: 'b' });
    expect(next.map((item) => item.id)).toEqual(['a', 'b']);
    expect(droppedActionId).toBeUndefined();
  });

  it('replaces an existing toast with the same id', () => {
    const { next, droppedActionId } = upsertNotificationStack(
      [
        { id: 'a', actionId: 'old' },
        { id: 'b' }
      ],
      { id: 'a', actionId: 'new' }
    );
    expect(next).toEqual([
      { id: 'a', actionId: 'new' },
      { id: 'b' }
    ]);
    expect(droppedActionId).toBe('old');
  });

  it('keeps the previous action when the replacement uses the same actionId', () => {
    const { next, droppedActionId } = upsertNotificationStack(
      [{ id: 'a', actionId: 'keep' }],
      { id: 'a', actionId: 'keep' }
    );
    expect(next).toEqual([{ id: 'a', actionId: 'keep' }]);
    expect(droppedActionId).toBeUndefined();
  });
});
