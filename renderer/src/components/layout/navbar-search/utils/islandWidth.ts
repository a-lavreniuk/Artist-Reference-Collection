/** Размеры для расчёта collapsed-ширины search-island (Figma Navbar Search Tag). */
export const COLLAPSED_ISLAND_LAYOUT = {
  searchIconWidth: 32,
  innerGap: 16,
  islandPadding: 24,
  defaultModesWidth: 128
} as const;

export function computeCollapsedIslandWidth(params: {
  modesWidth: number;
  placeholderWidth: number;
}): number {
  const { modesWidth, placeholderWidth } = params;
  const { searchIconWidth, innerGap, islandPadding } = COLLAPSED_ISLAND_LAYOUT;
  return Math.ceil(
    modesWidth + innerGap + placeholderWidth + innerGap + searchIconWidth + islandPadding
  );
}

export function resolveIslandWidthCss(isWide: boolean, collapsedPx: number, expandedWidthPx: number): string {
  if (isWide) {
    return `var(--arc-navbar-search-expanded-width, ${expandedWidthPx}px)`;
  }
  return `${collapsedPx}px`;
}
