import { describe, expect, it } from 'vitest';

import { sanitizeEyedropperHex } from '../colorEyedropperHex';

describe('sanitizeEyedropperHex', () => {
  it('accepts hash hex and uppercases it', () => {
    expect(sanitizeEyedropperHex('#e3b81a')).toBe('#E3B81A');
  });

  it('accepts hex without hash', () => {
    expect(sanitizeEyedropperHex('00ff10')).toBe('#00FF10');
  });

  it('rejects invalid values', () => {
    expect(sanitizeEyedropperHex('red')).toBeNull();
    expect(sanitizeEyedropperHex('#fff')).toBeNull();
    expect(sanitizeEyedropperHex(12)).toBeNull();
  });
});
