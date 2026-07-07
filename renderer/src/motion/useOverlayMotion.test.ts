import { describe, expect, it } from 'vitest';
import { resolveOverlayEntranceAction } from './useOverlayMotion';

describe('resolveOverlayEntranceAction', () => {
  const elA = { id: 'a' } as unknown as HTMLElement;
  const elB = { id: 'b' } as unknown as HTMLElement;

  it('skips when element is missing', () => {
    expect(resolveOverlayEntranceAction(false, null, null)).toBe('skip');
  });

  it('plays entrance on first open', () => {
    expect(resolveOverlayEntranceAction(false, elA, null)).toBe('entrance');
  });

  it('applies rest state on re-render while open (no repeat entrance)', () => {
    expect(resolveOverlayEntranceAction(true, elA, elA)).toBe('rest');
  });

  it('plays entrance again when DOM target changes', () => {
    expect(resolveOverlayEntranceAction(true, elB, elA)).toBe('entrance');
  });

  it('plays entrance after close and reopen cycle', () => {
    expect(resolveOverlayEntranceAction(false, elA, null)).toBe('entrance');
  });
});
