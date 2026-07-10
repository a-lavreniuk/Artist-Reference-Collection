export type SelectionRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export function toggleIdInSet(current: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function addIdToSet(current: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(current);
  next.add(id);
  return next;
}

export function addIdsToSet(current: ReadonlySet<string>, ids: Iterable<string>): Set<string> {
  const next = new Set(current);
  for (const id of ids) next.add(id);
  return next;
}

export function rangeSelectIds(
  orderedIds: readonly string[],
  anchorId: string | null,
  targetId: string,
  current: ReadonlySet<string>
): Set<string> {
  if (!anchorId) return addIdToSet(current, targetId);
  const anchorIndex = orderedIds.indexOf(anchorId);
  const targetIndex = orderedIds.indexOf(targetId);
  if (anchorIndex === -1 || targetIndex === -1) {
    return addIdToSet(current, targetId);
  }
  const start = Math.min(anchorIndex, targetIndex);
  const end = Math.max(anchorIndex, targetIndex);
  const next = new Set(current);
  for (let i = start; i <= end; i++) {
    const id = orderedIds[i];
    if (id) next.add(id);
  }
  return next;
}

function rectsIntersect(a: SelectionRect, b: DOMRect): boolean {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

export function idsIntersectingRect(
  cardRects: ReadonlyMap<string, DOMRect>,
  rect: SelectionRect
): string[] {
  const ids: string[] = [];
  for (const [id, domRect] of cardRects) {
    if (rectsIntersect(rect, domRect)) ids.push(id);
  }
  return ids;
}

export function normalizeSelectionRect(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): SelectionRect {
  return {
    left: Math.min(startX, endX),
    top: Math.min(startY, endY),
    right: Math.max(startX, endX),
    bottom: Math.max(startY, endY)
  };
}

export { isEditableTarget } from '../../shortcuts/shortcutGuards';
