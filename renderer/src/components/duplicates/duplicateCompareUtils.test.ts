import { describe, expect, it } from 'vitest';
import { formatPairLibraryNames } from './duplicateCompareUtils';

describe('formatPairLibraryNames', () => {
  it('joins different library names with a slash', () => {
    expect(formatPairLibraryNames('Основная', 'Запасная', 'a', 'b')).toBe('Основная / Запасная');
  });

  it('shows one name when both sides are the same library', () => {
    expect(formatPairLibraryNames('Основная', 'Основная', 'lib-1', 'lib-1')).toBe('Основная');
  });

  it('returns null when both names are empty', () => {
    expect(formatPairLibraryNames(null, undefined)).toBeNull();
  });
});
