import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';

type DragState = {
  pointerId: number;
  startClientX: number;
  initialScrollLeft: number;
  dragging: boolean;
};

type Options = {
  scrollStepPx?: number;
};

export function useHorizontalScrollStrip({ scrollStepPx = 280 }: Options = {}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  const updateEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setCanScrollBack(false);
      setCanScrollForward(false);
      return;
    }
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    const left = el.scrollLeft;
    setCanScrollBack(left > 1);
    setCanScrollForward(left < max - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateEdges();
    el.addEventListener('scroll', updateEdges, { passive: true });
    const ro = new ResizeObserver(() => updateEdges());
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateEdges);
      ro.disconnect();
    };
  }, [updateEdges]);

  const scrollByStep = useCallback(
    (direction: -1 | 1) => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollBy({ left: direction * scrollStepPx, behavior: 'smooth' });
    },
    [scrollStepPx]
  );

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.arc-gallery-collections-strip__arrow')) return;
    const el = scrollRef.current;
    if (!el) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      initialScrollLeft: el.scrollLeft,
      dragging: false
    };
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const el = scrollRef.current;
    if (!d || !el || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startClientX;
    if (!d.dragging) {
      if (Math.abs(dx) <= 6) return;
      d.dragging = true;
      suppressClickRef.current = true;
      setDragging(true);
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    e.preventDefault();
    el.scrollLeft = d.initialScrollLeft - (e.clientX - d.startClientX);
  }, []);

  const onPointerEnd = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const el = scrollRef.current;
    const wasDragging = Boolean(d?.dragging);
    if (d?.dragging && d.pointerId === e.pointerId && el) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    if (wasDragging) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    } else {
      suppressClickRef.current = false;
    }
    dragRef.current = null;
    setDragging(false);
    updateEdges();
  }, [updateEdges]);

  const onWheel = useCallback((e: ReactWheelEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    if (max <= 0) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
    updateEdges();
  }, [updateEdges]);

  const shouldSuppressChildClick = useCallback(() => suppressClickRef.current, []);

  return {
    scrollRef,
    dragging,
    canScrollBack,
    canScrollForward,
    scrollByStep,
    onPointerDown,
    onPointerMove,
    onPointerEnd,
    onWheel,
    shouldSuppressChildClick,
    updateEdges
  };
}
