import { describe, expect, it, beforeEach } from 'vitest';

import {
  clearDestructiveConfirms,
  consumeDestructiveConfirm,
  issueDestructiveConfirm
} from '../destructiveConfirm';

describe('destructiveConfirm', () => {
  beforeEach(() => {
    clearDestructiveConfirms();
  });

  it('rejects missing or wrong token', () => {
    expect(consumeDestructiveConfirm(undefined, 'empty-trash')).toBe(false);
    expect(consumeDestructiveConfirm('nope', 'empty-trash')).toBe(false);
  });

  it('accepts matching kind once', () => {
    const token = issueDestructiveConfirm('empty-trash');
    expect(consumeDestructiveConfirm(token, 'empty-trash')).toBe(true);
    expect(consumeDestructiveConfirm(token, 'empty-trash')).toBe(false);
  });

  it('rejects wrong kind', () => {
    const token = issueDestructiveConfirm('empty-trash');
    expect(consumeDestructiveConfirm(token, 'permanent-delete-card')).toBe(false);
  });

  it('supports multi-use for bulk delete', () => {
    const token = issueDestructiveConfirm('permanent-delete-card', { uses: 3 });
    expect(consumeDestructiveConfirm(token, 'permanent-delete-card')).toBe(true);
    expect(consumeDestructiveConfirm(token, 'permanent-delete-card')).toBe(true);
    expect(consumeDestructiveConfirm(token, 'permanent-delete-card')).toBe(true);
    expect(consumeDestructiveConfirm(token, 'permanent-delete-card')).toBe(false);
  });

  it('enforces binding when set', () => {
    const token = issueDestructiveConfirm('delete-library-disk', { binding: 'lib-1' });
    expect(consumeDestructiveConfirm(token, 'delete-library-disk', 'lib-2')).toBe(false);
    expect(consumeDestructiveConfirm(token, 'delete-library-disk', 'lib-1')).toBe(true);
  });
});
