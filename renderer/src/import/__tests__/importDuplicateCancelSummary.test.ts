import { describe, expect, it } from 'vitest';
import {
  applyDuplicateResolve,
  duplicateCancelToastMessage,
  emptyDuplicateSessionCounts,
  summarizeDuplicateCancel
} from '../importDuplicateCancelSummary';

describe('importDuplicateCancelSummary', () => {
  it('counts clean + replace + keep both as added', () => {
    expect(
      summarizeDuplicateCancel({
        cleanAdded: 3,
        replaceCount: 1,
        keepBothCount: 2,
        keepExistingCount: 0,
        remaining: 0
      })
    ).toEqual({ added: 6, notAdded: 0 });
  });

  it('counts keep existing and remaining as not added, including current', () => {
    expect(
      summarizeDuplicateCancel({
        cleanAdded: 2,
        replaceCount: 0,
        keepBothCount: 0,
        keepExistingCount: 1,
        remaining: 4
      })
    ).toEqual({ added: 2, notAdded: 5 });
  });

  it('applies resolve kinds onto a session', () => {
    const session = emptyDuplicateSessionCounts();
    session.cleanAdded = 1;
    applyDuplicateResolve(session, 'replace');
    applyDuplicateResolve(session, 'keep-both');
    applyDuplicateResolve(session, 'keep-existing');
    expect(summarizeDuplicateCancel({ ...session, remaining: 2 })).toEqual({
      added: 3,
      notAdded: 3
    });
  });

  it('formats toast with both numbers when something was added', () => {
    expect(duplicateCancelToastMessage(3, 2)).toBe('Добавлено 3, не добавлено 2');
  });

  it('formats toast without added count when nothing was added', () => {
    expect(duplicateCancelToastMessage(0, 1)).toBe('Файл не добавлен');
    expect(duplicateCancelToastMessage(0, 5)).toBe('Не добавлено 5 файлов');
  });
});
