import { describe, expect, it } from 'vitest';

import { shouldExcludeWindowAtPoint } from '../screenshotWindowBoundsTypes';

describe('shouldExcludeWindowAtPoint', () => {
  it('excludes arc overlay titles', () => {
    expect(
      shouldExcludeWindowAtPoint({
        title: 'ARC screenshot window picker',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      })
    ).toBe(true);
  });

  it('allows regular app windows', () => {
    expect(
      shouldExcludeWindowAtPoint({
        title: 'Notepad',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      })
    ).toBe(false);
  });
});
