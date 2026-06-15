import type { GridSize } from '../../layout/gridSizePreference';
import type { MasonryColumnRuleSet, MasonryVariant } from './masonryTypes';

type VariantColumnRules = {
  default: MasonryColumnRuleSet;
  breakpoints: { maxWidth: number; counts: MasonryColumnRuleSet }[];
};

const GALLERY_RULES: VariantColumnRules = {
  default: { l: 4, m: 6, s: 8 },
  breakpoints: [
    { maxWidth: 1440, counts: { l: 4, m: 5, s: 6 } },
    { maxWidth: 1400, counts: { l: 4, m: 5, s: 5 } },
    { maxWidth: 1200, counts: { l: 3, m: 4, s: 4 } },
    { maxWidth: 900, counts: { l: 2, m: 3, s: 3 } },
    { maxWidth: 600, counts: { l: 2, m: 2, s: 2 } }
  ]
};

const COLLECTIONS_RULES: VariantColumnRules = {
  default: { l: 3, m: 4, s: 5 },
  breakpoints: [
    { maxWidth: 1440, counts: { l: 3, m: 4, s: 4 } },
    { maxWidth: 1200, counts: { l: 2, m: 3, s: 3 } },
    { maxWidth: 900, counts: { l: 2, m: 2, s: 2 } }
  ]
};

const SIMILAR_RULES: VariantColumnRules = {
  default: { l: 3, m: 5, s: 7 },
  breakpoints: [
    { maxWidth: 1440, counts: { l: 3, m: 4, s: 5 } },
    { maxWidth: 1400, counts: { l: 3, m: 4, s: 4 } },
    { maxWidth: 1200, counts: { l: 2, m: 3, s: 3 } },
    { maxWidth: 900, counts: { l: 2, m: 2, s: 2 } }
  ]
};

const RULES_BY_VARIANT: Record<MasonryVariant, VariantColumnRules> = {
  gallery: GALLERY_RULES,
  collections: COLLECTIONS_RULES,
  similar: SIMILAR_RULES
};

export function resolveMasonryColumnCount(
  containerWidth: number,
  gridSize: GridSize,
  variant: MasonryVariant
): number {
  if (containerWidth <= 0) return 1;
  const rules = RULES_BY_VARIANT[variant];
  let counts = rules.default;
  for (const bp of rules.breakpoints) {
    if (containerWidth <= bp.maxWidth) {
      counts = bp.counts;
    }
  }
  return Math.max(1, counts[gridSize]);
}

export function computeMasonryColumnWidth(
  containerWidth: number,
  columnCount: number,
  gap: number
): number {
  if (columnCount <= 0) return 0;
  return (containerWidth - gap * (columnCount - 1)) / columnCount;
}
