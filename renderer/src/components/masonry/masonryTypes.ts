import type { GridSize } from '../../layout/gridSizePreference';

export type MasonryVariant = 'gallery' | 'collections' | 'similar';

export type MasonryItemInput = {
  id: string;
  height: number;
};

export type MasonryItemLayout = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  column: number;
};

export type MasonryLayoutState = {
  items: Map<string, MasonryItemLayout>;
  columnHeights: number[];
  columnItemIds: string[][];
  totalHeight: number;
  columnCount: number;
  containerWidth: number;
  columnWidth: number;
  gap: number;
};

export type MasonryColumnRuleSet = Record<GridSize, number>;

export const MASONRY_GAP_PX = 32;
export const MASONRY_GAP_PX_S = 16;

export function resolveMasonryGapPx(gridSize: GridSize): number {
  return gridSize === 's' ? MASONRY_GAP_PX_S : MASONRY_GAP_PX;
}

export const MASONRY_OVERSCAN_FACTOR = 1.5;
export const MASONRY_LOADING_SKELETON_COUNT = 6;
