import { thumbRequiredMaxSidePx } from '@arc-main-shared/thumbConstants';

export const ARC_THUMB_BUDGET_CHANGED_EVENT = 'arc:thumb-budget-changed';

let currentRequiredMaxSidePx = 0;

function emitThumbBudgetChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ARC_THUMB_BUDGET_CHANGED_EVENT));
}

export function setGalleryThumbPixelBudget(columnWidthCssPx: number): void {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const next = thumbRequiredMaxSidePx(columnWidthCssPx, dpr);
  if (next === currentRequiredMaxSidePx) return;
  currentRequiredMaxSidePx = next;
  emitThumbBudgetChanged();
}

export function readGalleryThumbPixelBudget(): number {
  return currentRequiredMaxSidePx;
}
