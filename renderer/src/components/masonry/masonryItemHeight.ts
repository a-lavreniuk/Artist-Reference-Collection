import { galleryCardAspectRatio } from '../gallery/gallerySkeleton';
import type { CardRecord } from '../../services/db';
import { computeMasonryColumnWidth } from './masonryColumnRules';

const measuredHeights = new Map<string, number>();

function measureKey(cardId: string, columnWidth: number): string {
  return `${cardId}@${Math.round(columnWidth)}`;
}

export function recordMeasuredMasonryHeight(cardId: string, columnWidth: number, height: number): void {
  if (height <= 0 || columnWidth <= 0) return;
  measuredHeights.set(measureKey(cardId, columnWidth), Math.round(height));
}

export function peekMeasuredMasonryHeight(cardId: string, columnWidth: number): number | undefined {
  return measuredHeights.get(measureKey(cardId, columnWidth));
}

export function clearMeasuredMasonryHeights(): void {
  measuredHeights.clear();
}

export function galleryMasonryItemHeight(
  card: CardRecord,
  containerWidth: number,
  columnCount: number,
  gap: number
): number {
  const columnWidth = computeMasonryColumnWidth(containerWidth, columnCount, gap);
  if (columnWidth <= 0) return 120;

  const cached = peekMeasuredMasonryHeight(card.id, columnWidth);
  if (cached !== undefined) return cached;

  const aspect = galleryCardAspectRatio(card);
  return Math.round(columnWidth / aspect);
}
