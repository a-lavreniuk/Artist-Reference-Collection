import type { MasonryItemLayout } from './masonryTypes';

const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

function centerOf(layout: MasonryItemLayout): { x: number; y: number } {
  return { x: layout.x + layout.width / 2, y: layout.y + layout.height / 2 };
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function findArrowTargetId(
  currentId: string,
  direction: string,
  layouts: Map<string, MasonryItemLayout>,
  mountedIds: readonly string[]
): string | null {
  const current = layouts.get(currentId);
  if (!current || !ARROW_KEYS.has(direction)) return null;

  const { x: cx, y: cy } = centerOf(current);
  let bestId: string | null = null;
  let bestScore = Infinity;

  for (const id of mountedIds) {
    if (id === currentId) continue;
    const layout = layouts.get(id);
    if (!layout) continue;

    const { x: tx, y: ty } = centerOf(layout);
    const dx = tx - cx;
    const dy = ty - cy;

    if (direction === 'ArrowRight' && dx <= 4) continue;
    if (direction === 'ArrowLeft' && dx >= -4) continue;
    if (direction === 'ArrowDown' && dy <= 4) continue;
    if (direction === 'ArrowUp' && dy >= -4) continue;

    const primary = direction === 'ArrowLeft' || direction === 'ArrowRight' ? Math.abs(dx) : Math.abs(dy);
    const secondary = direction === 'ArrowLeft' || direction === 'ArrowRight' ? Math.abs(dy) : Math.abs(dx);
    const score = primary * 10000 + secondary + distance(cx, cy, tx, ty) * 0.001;

    if (score < bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  return bestId;
}

export function handleMasonryArrowKey(
  event: React.KeyboardEvent,
  layouts: Map<string, MasonryItemLayout>,
  mountedIds: readonly string[],
  focusItem: (id: string) => void
): boolean {
  if (!ARROW_KEYS.has(event.key)) return false;
  const active = document.activeElement;
  const currentId =
    active?.getAttribute('data-masonry-item-id') ??
    active?.closest('[data-masonry-item-id]')?.getAttribute('data-masonry-item-id') ??
    null;
  if (!currentId) return false;

  const nextId = findArrowTargetId(currentId, event.key, layouts, mountedIds);
  if (!nextId) return false;

  event.preventDefault();
  focusItem(nextId);
  return true;
}
