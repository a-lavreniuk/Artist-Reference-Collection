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

export function removeIdsFromSet(current: ReadonlySet<string>, ids: Iterable<string>): Set<string> {
  const next = new Set(current);
  for (const id of ids) next.delete(id);
  return next;
}

/** Рамка без модификаторов заменяет выделение, Ctrl добавляет, Alt вычитает. */
export type MarqueeMode = 'replace' | 'add' | 'subtract';

export function resolveMarqueeMode(modifiers: {
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}): MarqueeMode {
  if (modifiers.altKey) return 'subtract';
  if (modifiers.ctrlKey || modifiers.metaKey) return 'add';
  return 'replace';
}

export function computeMarqueeSelection(
  base: ReadonlySet<string>,
  inside: ReadonlySet<string>,
  mode: MarqueeMode
): Set<string> {
  if (mode === 'replace') return new Set(inside);
  if (mode === 'add') return addIdsToSet(base, inside);
  return removeIdsFromSet(base, inside);
}

export function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
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

function rectsIntersect(a: SelectionRect, b: SelectionRect): boolean {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

export function idsIntersectingRect(
  cardRects: ReadonlyMap<string, SelectionRect>,
  rect: SelectionRect
): string[] {
  const ids: string[] = [];
  for (const [id, cardRect] of cardRects) {
    if (rectsIntersect(rect, cardRect)) ids.push(id);
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
