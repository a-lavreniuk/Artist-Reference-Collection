import { describe, expect, it } from 'vitest';
import {
  isExpiredDeletedAt,
  sanitizeTrashRetentionDays,
  trashCutoffIso
} from '../trashRetention';

describe('trashRetention', () => {
  it('sanitizes allowed day values and defaults to 30', () => {
    expect(sanitizeTrashRetentionDays(7)).toBe(7);
    expect(sanitizeTrashRetentionDays(0)).toBe(0);
    expect(sanitizeTrashRetentionDays('90')).toBe(90);
    expect(sanitizeTrashRetentionDays(12)).toBe(30);
    expect(sanitizeTrashRetentionDays(undefined)).toBe(30);
  });

  it('returns null cutoff when never auto-purge', () => {
    expect(trashCutoffIso(new Date('2026-08-14T12:00:00.000Z'), 0)).toBeNull();
    expect(trashCutoffIso(new Date('2026-08-14T12:00:00.000Z'), -1)).toBeNull();
  });

  it('computes cutoff 30 days before now', () => {
    const now = new Date('2026-08-14T12:00:00.000Z');
    expect(trashCutoffIso(now, 30)).toBe('2026-07-15T12:00:00.000Z');
  });

  it('does not expire empty deleted_at', () => {
    const cutoff = '2026-07-15T12:00:00.000Z';
    expect(isExpiredDeletedAt(null, cutoff)).toBe(false);
    expect(isExpiredDeletedAt('', cutoff)).toBe(false);
    expect(isExpiredDeletedAt('   ', cutoff)).toBe(false);
    expect(isExpiredDeletedAt('2026-06-01T00:00:00.000Z', cutoff)).toBe(true);
    expect(isExpiredDeletedAt('2026-08-01T00:00:00.000Z', cutoff)).toBe(false);
  });
});
