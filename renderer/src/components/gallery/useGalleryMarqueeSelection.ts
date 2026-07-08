import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  idsIntersectingRect,
  normalizeSelectionRect,
  type SelectionRect
} from './galleryCardSelectionCore';

type Options = {
  boardRef: RefObject<HTMLElement | null>;
  scrollRootRef: RefObject<HTMLElement | null>;
  selectionMode: boolean;
  enabled: boolean;
  onMarqueeSelect: (cardIds: string[]) => void;
};

type MarqueeState = {
  rect: SelectionRect;
};

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 8;

export function useGalleryMarqueeSelection({
  boardRef,
  scrollRootRef,
  selectionMode,
  enabled,
  onMarqueeSelect
}: Options) {
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    additiveSnapshot: string[];
  } | null>(null);

  const collectCardRects = useCallback((): Map<string, DOMRect> => {
    const root = boardRef.current;
    const map = new Map<string, DOMRect>();
    if (!root) return map;
    const nodes = root.querySelectorAll<HTMLElement>('[data-gallery-card-id]');
    for (const node of nodes) {
      const id = node.dataset.galleryCardId;
      if (!id) continue;
      map.set(id, node.getBoundingClientRect());
    }
    return map;
  }, [boardRef]);

  useEffect(() => {
    if (!enabled) return undefined;

    const EDGE = 72;
    const maxStep = 24;
    let rafId = 0;
    let edgeVy = 0;

    const step = () => {
      const scrollEl = scrollRootRef.current;
      if (edgeVy !== 0 && scrollEl) {
        scrollEl.scrollTop += edgeVy;
      }
      if (edgeVy !== 0) {
        rafId = window.requestAnimationFrame(step);
      } else {
        rafId = 0;
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
      const scrollEl = scrollRootRef.current;
      if (scrollEl) {
        const rect = scrollEl.getBoundingClientRect();
        const y = event.clientY;
        const edgeTop = Math.max(48, Math.min(96, Math.round(rect.height * 0.18)));
        let next = 0;
        if (y < rect.top + edgeTop) {
          next = -Math.ceil(((rect.top + edgeTop - y) / edgeTop) * maxStep);
          next = Math.max(next, -maxStep);
        } else if (y > rect.bottom - EDGE) {
          next = Math.ceil(((y - (rect.bottom - EDGE)) / EDGE) * maxStep);
          next = Math.min(next, maxStep);
        }
        edgeVy = next;
        if (edgeVy !== 0 && !rafId) {
          rafId = window.requestAnimationFrame(step);
        }
        if (edgeVy === 0 && rafId) {
          window.cancelAnimationFrame(rafId);
          rafId = 0;
        }
      }

      const rect = normalizeSelectionRect(
        dragRef.current.startX,
        dragRef.current.startY,
        event.clientX,
        event.clientY
      );
      setMarquee({ rect });
    };

    const finishDrag = (event: PointerEvent) => {
      if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
      const finalRect = normalizeSelectionRect(
        dragRef.current.startX,
        dragRef.current.startY,
        event.clientX,
        event.clientY
      );
      const width = finalRect.right - finalRect.left;
      const height = finalRect.bottom - finalRect.top;
      if (width >= 4 && height >= 4) {
        const hits = idsIntersectingRect(collectCardRects(), finalRect);
        if (hits.length > 0) onMarqueeSelect(hits);
      }
      dragRef.current = null;
      setMarquee(null);
      edgeVy = 0;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const ctrl = event.ctrlKey || event.metaKey;
      if (!ctrl && !selectionMode) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-gallery-card-id]')) return;
      if (target.closest('.arc-gallery-selection-bar')) return;
      if (target.closest('.arc-modal-host')) return;

      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        additiveSnapshot: []
      };
      setMarquee({
        rect: normalizeSelectionRect(event.clientX, event.clientY, event.clientX, event.clientY)
      });
      event.preventDefault();
    };

    const root = boardRef.current;
    if (!root) return undefined;
    root.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);

    return () => {
      root.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
      edgeVy = 0;
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [boardRef, collectCardRects, enabled, onMarqueeSelect, scrollRootRef, selectionMode]);

  return { marquee };
}

export function useGalleryCardLongPress(
  onLongPress: (cardId: string) => void,
  enabled: boolean
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const cardIdRef = useRef<string | null>(null);
  const suppressNextClickRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    originRef.current = null;
    cardIdRef.current = null;
  }, []);

  const consumeSuppressedClick = useCallback(() => {
    if (!suppressNextClickRef.current) return false;
    suppressNextClickRef.current = false;
    return true;
  }, []);

  const onPointerDown = useCallback(
    (cardId: string, event: React.PointerEvent) => {
      if (!enabled || event.button !== 0) return;
      suppressNextClickRef.current = false;
      clearTimer();
      originRef.current = { x: event.clientX, y: event.clientY };
      cardIdRef.current = cardId;
      timerRef.current = setTimeout(() => {
        if (cardIdRef.current) {
          suppressNextClickRef.current = true;
          onLongPress(cardIdRef.current);
        }
        clearTimer();
      }, LONG_PRESS_MS);
    },
    [clearTimer, enabled, onLongPress]
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!originRef.current) return;
      const dx = event.clientX - originRef.current.x;
      const dy = event.clientY - originRef.current.y;
      if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clearTimer();
    },
    [clearTimer]
  );

  const onPointerUp = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  return { onPointerDown, onPointerMove, onPointerUp, consumeSuppressedClick };
}
