/** Pure geometry helpers for draggable / resizable floating panels (modals). */

export const FLOATING_PANEL_EDGE_PX = 8;

export type PanelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ViewportSize = {
  width: number;
  height: number;
};

export type PanelInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type ResizeEdge =
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw';

export const RESIZE_CURSOR: Record<ResizeEdge, string> = {
  n: 'n-resize',
  s: 's-resize',
  e: 'e-resize',
  w: 'w-resize',
  ne: 'ne-resize',
  nw: 'nw-resize',
  se: 'se-resize',
  sw: 'sw-resize'
};

export type StoredPanelGeometry = {
  x: number;
  y: number;
  width?: number;
  height?: number;
};

const sessionStore: Record<string, StoredPanelGeometry> = {};

export function readFloatingPanelSession(panelId: string): StoredPanelGeometry | null {
  const stored = sessionStore[panelId];
  return stored ? { ...stored } : null;
}

export function writeFloatingPanelSession(panelId: string, geometry: StoredPanelGeometry): void {
  sessionStore[panelId] = {
    x: geometry.x,
    y: geometry.y,
    ...(geometry.width != null ? { width: geometry.width } : {}),
    ...(geometry.height != null ? { height: geometry.height } : {})
  };
}

/** Test helper — clears in-memory session geometry. */
export function clearFloatingPanelSessionStore(): void {
  for (const key of Object.keys(sessionStore)) {
    delete sessionStore[key];
  }
}

export function centerPanelInViewport(
  size: { width: number; height: number },
  viewport: ViewportSize,
  insets: PanelInsets
): PanelRect {
  const availW = Math.max(0, viewport.width - insets.left - insets.right);
  const availH = Math.max(0, viewport.height - insets.top - insets.bottom);
  const width = Math.min(size.width, availW);
  const height = Math.min(size.height, availH);
  return {
    x: insets.left + (availW - width) / 2,
    y: insets.top + (availH - height) / 2,
    width,
    height
  };
}

export function clampPanelRect(
  rect: PanelRect,
  viewport: ViewportSize,
  insets: PanelInsets,
  minWidth: number,
  minHeight: number
): PanelRect {
  const maxW = Math.max(minWidth, viewport.width - insets.left - insets.right);
  const maxH = Math.max(minHeight, viewport.height - insets.top - insets.bottom);
  const width = Math.min(Math.max(rect.width, minWidth), maxW);
  const height = Math.min(Math.max(rect.height, minHeight), maxH);
  const minX = insets.left;
  const minY = insets.top;
  const maxX = Math.max(minX, viewport.width - insets.right - width);
  const maxY = Math.max(minY, viewport.height - insets.bottom - height);
  return {
    x: Math.min(Math.max(rect.x, minX), maxX),
    y: Math.min(Math.max(rect.y, minY), maxY),
    width,
    height
  };
}

/**
 * Hit-test resize edge from pointer coords relative to panel top-left.
 * Corners win over edges when both apply.
 */
export function hitTestResizeEdge(
  localX: number,
  localY: number,
  width: number,
  height: number,
  edgePx: number = FLOATING_PANEL_EDGE_PX
): ResizeEdge | null {
  if (width <= 0 || height <= 0) return null;
  const onW = localX <= edgePx;
  const onE = localX >= width - edgePx;
  const onN = localY <= edgePx;
  const onS = localY >= height - edgePx;
  if (onN && onW) return 'nw';
  if (onN && onE) return 'ne';
  if (onS && onW) return 'sw';
  if (onS && onE) return 'se';
  if (onN) return 'n';
  if (onS) return 's';
  if (onW) return 'w';
  if (onE) return 'e';
  return null;
}

export function applyResizeDelta(
  start: PanelRect,
  edge: ResizeEdge,
  deltaX: number,
  deltaY: number,
  minWidth: number,
  minHeight: number
): PanelRect {
  let { x, y, width, height } = start;

  if (edge.includes('e')) {
    width = start.width + deltaX;
  }
  if (edge.includes('s')) {
    height = start.height + deltaY;
  }
  if (edge.includes('w')) {
    width = start.width - deltaX;
    x = start.x + deltaX;
  }
  if (edge.includes('n')) {
    height = start.height - deltaY;
    y = start.y + deltaY;
  }

  if (width < minWidth) {
    if (edge.includes('w')) {
      x = start.x + start.width - minWidth;
    }
    width = minWidth;
  }
  if (height < minHeight) {
    if (edge.includes('n')) {
      y = start.y + start.height - minHeight;
    }
    height = minHeight;
  }

  return { x, y, width, height };
}

export function applyMoveDelta(start: PanelRect, deltaX: number, deltaY: number): PanelRect {
  return {
    x: start.x + deltaX,
    y: start.y + deltaY,
    width: start.width,
    height: start.height
  };
}

const DEFAULT_MOVE_BLOCK_SELECTOR = [
  'button',
  'input',
  'textarea',
  'select',
  'a',
  'label',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="checkbox"]',
  '[contenteditable="true"]',
  '.chip',
  '.arc-checkbox'
].join(',');

/**
 * Returns true when the event target should start a move drag
 * (not interactive chrome / scroll regions).
 *
 * If `allowSelectors` is non-empty, the target must match one of them
 * (or be the panel root) in addition to passing block checks.
 */
export function isMoveDragTarget(
  target: EventTarget | null,
  panel: HTMLElement,
  blockSelectors: string[] = [],
  scrollBlockSelectors: string[] = [],
  allowSelectors: string[] = []
): boolean {
  if (!(target instanceof Element)) return false;
  if (!panel.contains(target)) return false;

  const blocks = [DEFAULT_MOVE_BLOCK_SELECTOR, ...blockSelectors].filter(Boolean).join(',');
  if (blocks && target.closest(blocks)) return false;

  for (const sel of scrollBlockSelectors) {
    if (sel && target.closest(sel)) return false;
  }

  if (allowSelectors.length > 0) {
    if (target === panel) return true;
    return allowSelectors.some((sel) => Boolean(sel && target.closest(sel)));
  }

  return true;
}
