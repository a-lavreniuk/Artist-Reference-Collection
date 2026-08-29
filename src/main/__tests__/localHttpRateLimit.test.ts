import { describe, expect, it } from 'vitest';
import { isLocalHttpRateLimited } from '../localHttpRateLimit';

describe('isLocalHttpRateLimited', () => {
  it('allows a burst then limits', () => {
    let limited = false;
    for (let i = 0; i < 80; i += 1) {
      if (isLocalHttpRateLimited()) limited = true;
    }
    expect(limited).toBe(true);
  });
});
