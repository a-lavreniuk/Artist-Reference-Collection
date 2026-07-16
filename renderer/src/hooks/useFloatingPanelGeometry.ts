import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from 'react';
import {
  FLOATING_PANEL_EDGE_PX,
  RESIZE_CURSOR,
  applyMoveDelta,
  applyResizeDelta,
  centerPanelInViewport,
  clampPanelRect,
  hitTestResizeEdge,
  isMoveDragTarget,
  readFloatingPanelSession,
  writeFloatingPanelSession,
  type PanelInsets,
  type PanelRect,
  type ResizeEdge
} from './floatingPanelGeometry';

export type UseFloatingPanelGeometryOptions = {
  panelId: string;
  /** Default size when session has no stored width/height. */
  defaultWidth: number;
  defaultHeight: number;
  minWidth?: number;
  minHeight?: number;
  resizable?: boolean;
  /** Viewport insets (host padding). Defaults to 32px all sides (`--s-4`). */
  insets?: PanelInsets;
  /** Extra CSS selectors that block move-drag (in addition to defaults). */
  moveBlockSelectors?: string[];
  /** Scroll regions that must not start a move-drag. */
  scrollBlockSelectors?: string[];
  /**
   * If set, move-drag only starts when the target matches one of these
   * (or is the panel root), after passing block checks.
   */
  moveAllowSelectors?: string[];
  edgePx?: number;
};

type DragMode =
  | { kind: 'move'; start: PanelRect; pointerX: number; pointerY: number }
  | { kind: 'resize'; edge: ResizeEdge; start: PanelRect; pointerX: number; pointerY: number };

const DEFAULT_INSETS: PanelInsets = { top: 32, right: 32, bottom: 32, left: 32 };

function viewportSize() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function resolveInitialRect(options: UseFloatingPanelGeometryOptions): PanelRect {
  const insets = options.insets ?? DEFAULT_INSETS;
  const minW = options.minWidth ?? options.defaultWidth;
  const minH = options.minHeight ?? options.defaultHeight;
  const stored = readFloatingPanelSession(options.panelId);
  const baseSize = {
    width: stored?.width ?? options.defaultWidth,
    height: stored?.height ?? options.defaultHeight
  };

  if (stored) {
    return clampPanelRect(
      {
        x: stored.x,
        y: stored.y,
        width: baseSize.width,
        height: baseSize.height
      },
      viewportSize(),
      insets,
      minW,
      minH
    );
  }

  return clampPanelRect(
    centerPanelInViewport(baseSize, viewportSize(), insets),
    viewportSize(),
    insets,
    minW,
    minH
  );
}

function writeRectToElement(el: HTMLElement, rect: PanelRect, writeSize: boolean): void {
  el.style.left = `${rect.x}px`;
  el.style.top = `${rect.y}px`;
  if (writeSize) {
    el.style.width = `${rect.width}px`;
    el.style.height = `${rect.height}px`;
  }
}

/**
 * Positions a floating panel (modal content) with optional edge resize.
 * Geometry is stored in a module-level session map keyed by `panelId`.
 *
 * During drag/resize, geometry is written directly to the DOM
 * (no React re-render per pointermove) — important for heavy panel content.
 * When `resizable` is false, only left/top are written; size stays in CSS.
 */
export function useFloatingPanelGeometry(options: UseFloatingPanelGeometryOptions) {
  const {
    panelId,
    defaultWidth,
    defaultHeight,
    minWidth = defaultWidth,
    minHeight = defaultHeight,
    resizable = false,
    insets = DEFAULT_INSETS,
    moveBlockSelectors = [],
    scrollBlockSelectors = [],
    moveAllowSelectors = [],
    edgePx = FLOATING_PANEL_EDGE_PX
  } = options;

  const panelRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef<PanelRect | null>(null);
  const dragRef = useRef<DragMode | null>(null);
  const cursorRef = useRef<string>('');
  const [ready, setReady] = useState(false);

  const persist = useCallback(
    (next: PanelRect) => {
      writeFloatingPanelSession(panelId, {
        x: next.x,
        y: next.y,
        ...(resizable ? { width: next.width, height: next.height } : {})
      });
    },
    [panelId, resizable]
  );

  const applyRect = useCallback(
    (next: PanelRect, persistNow = false) => {
      const sizeMinW = resizable ? minWidth : next.width;
      const sizeMinH = resizable ? minHeight : next.height;
      const clamped = clampPanelRect(next, viewportSize(), insets, sizeMinW, sizeMinH);
      rectRef.current = clamped;
      const el = panelRef.current;
      if (el) writeRectToElement(el, clamped, resizable);
      if (persistNow) persist(clamped);
      return clamped;
    },
    [insets, minHeight, minWidth, persist, resizable]
  );

  const setPanelCursor = useCallback((cursor: string) => {
    if (cursorRef.current === cursor) return;
    cursorRef.current = cursor;
    const el = panelRef.current;
    if (el) el.style.cursor = cursor;
  }, []);

  const measureCssSize = useCallback((): { width: number; height: number } => {
    const el = panelRef.current;
    if (!el) return { width: defaultWidth, height: defaultHeight };
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    return {
      width: w > 0 ? w : defaultWidth,
      height: h > 0 ? h : defaultHeight
    };
  }, [defaultHeight, defaultWidth]);

  useLayoutEffect(() => {
    const measured = resizable
      ? { width: defaultWidth, height: defaultHeight }
      : measureCssSize();
    const initial = resolveInitialRect({
      panelId,
      defaultWidth: measured.width,
      defaultHeight: measured.height,
      minWidth: resizable ? minWidth : measured.width,
      minHeight: resizable ? minHeight : measured.height,
      resizable,
      insets
    });
    rectRef.current = initial;
    const el = panelRef.current;
    if (el) writeRectToElement(el, initial, resizable);
    setReady(true);
  }, [
    panelId,
    defaultWidth,
    defaultHeight,
    minWidth,
    minHeight,
    resizable,
    insets,
    measureCssSize
  ]);

  useEffect(() => {
    const onResize = () => {
      const current = rectRef.current;
      if (!current) return;
      if (!resizable) {
        const measured = measureCssSize();
        applyRect({ ...current, width: measured.width, height: measured.height }, true);
        return;
      }
      applyRect(current, true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [applyRect, measureCssSize, resizable]);

  const updateHoverCursor = useCallback(
    (clientX: number, clientY: number) => {
      const current = rectRef.current;
      if (!current || !resizable) {
        setPanelCursor('');
        return;
      }
      // Prefer stored geometry over getBoundingClientRect to avoid layout thrash
      // while hovering a large panel tree.
      const edge = hitTestResizeEdge(
        clientX - current.x,
        clientY - current.y,
        current.width,
        current.height,
        edgePx
      );
      setPanelCursor(edge ? RESIZE_CURSOR[edge] : '');
    },
    [edgePx, resizable, setPanelCursor]
  );

  const onPointerLeave = useCallback(() => {
    if (dragRef.current) return;
    setPanelCursor('');
  }, [setPanelCursor]);

  const finishDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!dragRef.current) return;
      dragRef.current = null;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }
      const current = rectRef.current;
      if (current) persist(current);
      updateHoverCursor(event.clientX, event.clientY);
    },
    [persist, updateHoverCursor]
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      const panel = panelRef.current;
      const current = rectRef.current;
      if (!panel || !current) return;

      const localX = event.clientX - current.x;
      const localY = event.clientY - current.y;

      if (resizable) {
        const edge = hitTestResizeEdge(localX, localY, current.width, current.height, edgePx);
        if (edge) {
          event.preventDefault();
          event.stopPropagation();
          dragRef.current = {
            kind: 'resize',
            edge,
            start: { ...current },
            pointerX: event.clientX,
            pointerY: event.clientY
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          setPanelCursor(RESIZE_CURSOR[edge]);
          return;
        }
      }

      if (
        !isMoveDragTarget(
          event.target,
          panel,
          moveBlockSelectors,
          scrollBlockSelectors,
          moveAllowSelectors
        )
      ) {
        return;
      }

      event.preventDefault();
      dragRef.current = {
        kind: 'move',
        start: { ...current },
        pointerX: event.clientX,
        pointerY: event.clientY
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setPanelCursor('move');
    },
    [
      edgePx,
      moveAllowSelectors,
      moveBlockSelectors,
      resizable,
      scrollBlockSelectors,
      setPanelCursor
    ]
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag) {
        updateHoverCursor(event.clientX, event.clientY);
        return;
      }

      const deltaX = event.clientX - drag.pointerX;
      const deltaY = event.clientY - drag.pointerY;
      const next =
        drag.kind === 'move'
          ? applyMoveDelta(drag.start, deltaX, deltaY)
          : applyResizeDelta(drag.start, drag.edge, deltaX, deltaY, minWidth, minHeight);
      // DOM-only update — avoid re-rendering heavy modal content every frame.
      applyRect(next, false);
    },
    [applyRect, minHeight, minWidth, updateHoverCursor]
  );

  const style: CSSProperties = {
    position: 'absolute',
    margin: 0,
    visibility: ready ? 'visible' : 'hidden',
    ...(resizable
      ? {
          maxWidth: 'none',
          maxHeight: 'none'
        }
      : {})
  };

  return {
    panelRef,
    style,
    rect: rectRef.current,
    onPointerDown,
    onPointerMove,
    onPointerUp: finishDrag,
    onPointerCancel: finishDrag,
    onPointerLeave,
    onPointerMoveHover: updateHoverCursor
  };
}
