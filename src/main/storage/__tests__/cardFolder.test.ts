import path from 'path';
import { describe, expect, it } from 'vitest';
import { cardDirAbs, isPlainCardId } from '../cardFolder';

describe('isPlainCardId', () => {
  it('accepts uuid-like ids', () => {
    expect(isPlainCardId('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
  });

  it('rejects path traversal and separators', () => {
    expect(isPlainCardId('')).toBe(false);
    expect(isPlainCardId('.')).toBe(false);
    expect(isPlainCardId('..')).toBe(false);
    expect(isPlainCardId('../meta')).toBe(false);
    expect(isPlainCardId('..\\meta')).toBe(false);
    expect(isPlainCardId('foo/bar')).toBe(false);
    expect(isPlainCardId('C:foo')).toBe(false);
  });
});

describe('cardDirAbs', () => {
  it('stays inside cards/', () => {
    const root = path.resolve('/tmp/arc-lib');
    const dir = cardDirAbs(root, 'card-id-1');
    expect(dir.startsWith(path.resolve(root, 'cards'))).toBe(true);
    expect(path.basename(dir)).toBe('card-id-1');
  });

  it('throws on traversal', () => {
    const root = path.resolve('/tmp/arc-lib');
    expect(() => cardDirAbs(root, '../meta')).toThrow(/Некорректный/);
    expect(() => cardDirAbs(root, '..')).toThrow(/Некорректный/);
  });
});
