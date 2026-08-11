import { afterEach, describe, expect, it, vi } from 'vitest';
import { isContextMenuOpen } from './shortcutGuards';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isContextMenuOpen', () => {
  it('ignores static menus — сайдбары коллекций, меток и настроек', () => {
    const queries: string[] = [];
    vi.stubGlobal('document', {
      querySelector: (selector: string) => {
        queries.push(selector);
        return null;
      }
    });

    expect(isContextMenuOpen()).toBe(false);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain(':not(.context-menu--static)');
  });

  it('reports an open popup menu', () => {
    vi.stubGlobal('document', {
      querySelector: () => ({}) as unknown as Element
    });

    expect(isContextMenuOpen()).toBe(true);
  });
});
