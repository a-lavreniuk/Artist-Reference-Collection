import { computeMasonryColumnWidth } from './masonryColumnRules';
import type { MasonryItemInput, MasonryItemLayout, MasonryLayoutState } from './masonryTypes';

function shortestColumnIndex(columnHeights: number[]): number {
  let min = 0;
  for (let i = 1; i < columnHeights.length; i += 1) {
    if (columnHeights[i] < columnHeights[min]) min = i;
  }
  return min;
}

function computeTotalHeight(columnHeights: number[], gap: number): number {
  if (columnHeights.length === 0) return 0;
  const max = Math.max(...columnHeights);
  return max > 0 ? max - gap : 0;
}

function placeItem(
  state: MasonryLayoutState,
  item: MasonryItemInput,
  column: number
): void {
  const { columnWidth, gap } = state;
  const x = column * (columnWidth + gap);
  const y = state.columnHeights[column];
  const layout: MasonryItemLayout = {
    id: item.id,
    x,
    y,
    width: columnWidth,
    height: item.height,
    column
  };
  state.items.set(item.id, layout);
  state.columnItemIds[column].push(item.id);
  state.columnHeights[column] = y + item.height + gap;
}

export function createEmptyLayoutState(
  columnCount: number,
  containerWidth: number,
  gap: number
): MasonryLayoutState {
  const columnWidth = computeMasonryColumnWidth(containerWidth, columnCount, gap);
  return {
    items: new Map(),
    columnHeights: Array.from({ length: columnCount }, () => 0),
    columnItemIds: Array.from({ length: columnCount }, () => []),
    totalHeight: 0,
    columnCount,
    containerWidth,
    columnWidth,
    gap
  };
}

export function layoutMasonryFull(
  items: MasonryItemInput[],
  columnCount: number,
  containerWidth: number,
  gap: number
): MasonryLayoutState {
  const state = createEmptyLayoutState(columnCount, containerWidth, gap);
  for (const item of items) {
    const column = shortestColumnIndex(state.columnHeights);
    placeItem(state, item, column);
  }
  state.totalHeight = computeTotalHeight(state.columnHeights, gap);
  return state;
}

export function layoutMasonryAppend(
  prev: MasonryLayoutState,
  newItems: MasonryItemInput[],
  columnCount: number,
  containerWidth: number,
  gap: number
): MasonryLayoutState {
  if (
    newItems.length === 0 ||
    columnCount !== prev.columnCount ||
    containerWidth !== prev.containerWidth ||
    gap !== prev.gap
  ) {
    return prev;
  }

  const state: MasonryLayoutState = {
    items: new Map(prev.items),
    columnHeights: [...prev.columnHeights],
    columnItemIds: prev.columnItemIds.map((col) => [...col]),
    totalHeight: prev.totalHeight,
    columnCount: prev.columnCount,
    containerWidth: prev.containerWidth,
    columnWidth: prev.columnWidth,
    gap: prev.gap
  };

  for (const item of newItems) {
    if (state.items.has(item.id)) continue;
    const column = shortestColumnIndex(state.columnHeights);
    placeItem(state, item, column);
  }

  state.totalHeight = computeTotalHeight(state.columnHeights, gap);
  return state;
}

export function layoutMasonryResizeItem(
  prev: MasonryLayoutState,
  itemId: string,
  newHeight: number
): MasonryLayoutState {
  const existing = prev.items.get(itemId);
  if (!existing || Math.abs(existing.height - newHeight) < 1) return prev;

  const delta = newHeight - existing.height;
  const state: MasonryLayoutState = {
    items: new Map(prev.items),
    columnHeights: [...prev.columnHeights],
    columnItemIds: prev.columnItemIds.map((col) => [...col]),
    totalHeight: prev.totalHeight,
    columnCount: prev.columnCount,
    containerWidth: prev.containerWidth,
    columnWidth: prev.columnWidth,
    gap: prev.gap
  };

  state.items.set(itemId, { ...existing, height: newHeight });

  const columnIds = state.columnItemIds[existing.column] ?? [];
  let found = false;
  for (const id of columnIds) {
    if (id === itemId) {
      found = true;
      continue;
    }
    if (!found) continue;
    const layout = state.items.get(id);
    if (!layout) continue;
    state.items.set(id, { ...layout, y: layout.y + delta });
  }

  state.columnHeights[existing.column] += delta;
  state.totalHeight = computeTotalHeight(state.columnHeights, state.gap);
  return state;
}

export function canIncrementalAppend(
  prevIds: readonly string[],
  nextIds: readonly string[]
): boolean {
  if (nextIds.length < prevIds.length) return false;
  for (let i = 0; i < prevIds.length; i += 1) {
    if (prevIds[i] !== nextIds[i]) return false;
  }
  return true;
}
