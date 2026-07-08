import { describe, expect, it } from 'vitest';
import {
  computeCollapsedIslandWidth,
  COLLAPSED_ISLAND_LAYOUT,
  resolveIslandExpanded
} from '../utils/islandWidth';

describe('computeCollapsedIslandWidth', () => {
  it('sums modes, placeholder, gaps, icon and padding', () => {
    const result = computeCollapsedIslandWidth({
      modesWidth: 128,
      placeholderWidth: 200
    });
    const { searchIconWidth, innerGap, islandPadding } = COLLAPSED_ISLAND_LAYOUT;
    expect(result).toBe(Math.ceil(128 + innerGap + 200 + innerGap + searchIconWidth + islandPadding));
  });

  it('rounds up fractional widths', () => {
    const result = computeCollapsedIslandWidth({
      modesWidth: 127.2,
      placeholderWidth: 199.1
    });
    expect(result).toBe(Math.ceil(127.2 + 16 + 199.1 + 16 + 32 + 24));
  });
});

describe('resolveIslandExpanded', () => {
  it('expands color mode for hex input width', () => {
    expect(
      resolveIslandExpanded({
        panelOpen: false,
        hasValue: true,
        searchIslandWidePinned: false,
        searchMode: 'color'
      })
    ).toBe(true);
  });

  it('expands color mode when panel is open', () => {
    expect(
      resolveIslandExpanded({
        panelOpen: true,
        hasValue: true,
        searchIslandWidePinned: false,
        searchMode: 'color'
      })
    ).toBe(true);
  });

  it('expands tags mode when hasValue', () => {
    expect(
      resolveIslandExpanded({
        panelOpen: false,
        hasValue: true,
        searchIslandWidePinned: false,
        searchMode: 'tags'
      })
    ).toBe(true);
  });
});
