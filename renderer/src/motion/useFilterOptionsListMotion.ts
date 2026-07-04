import { useLayoutEffect, useRef } from 'react';
import { arcMotionTokens, motionDuration } from './arcMotionTokens';
import { ensureGsapSetup } from './gsapSetup';
import { getPrefersReducedMotion } from './prefersReducedMotion';
import type { GalleryFilterId } from '../components/gallery/galleryFilterTypes';

type Args = {
  listRef: React.RefObject<HTMLDivElement | null>;
  order: GalleryFilterId[];
  isDragging: boolean;
};

/** Stagger on mount + FLIP reorder when drag is not active. */
export function useFilterOptionsListMotion({ listRef, order, isDragging }: Args): void {
  const prevOrderRef = useRef(order);
  const mountedRef = useRef(false);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const gsap = ensureGsapSetup();
    const reduced = getPrefersReducedMotion();
    const duration = motionDuration('fast', reduced);

    if (!mountedRef.current) {
      mountedRef.current = true;
      prevOrderRef.current = order;
      if (reduced) return;

      const rows = list.querySelectorAll<HTMLElement>('.context-menu__filter-row:not(.is-dragging)');
      gsap.fromTo(
        rows,
        { opacity: 0, scale: 0.98 },
        {
          opacity: 1,
          scale: 1,
          duration,
          stagger: arcMotionTokens.stagger,
          ease: arcMotionTokens.ease,
          overwrite: true
        }
      );
      return;
    }

    if (isDragging) {
      prevOrderRef.current = order;
      return;
    }

    const prevOrder = prevOrderRef.current;
    const changed = prevOrder.length !== order.length || prevOrder.some((id, i) => order[i] !== id);
    prevOrderRef.current = order;
    if (!changed || reduced) return;

    const firstRects = new Map<string, DOMRect>();
    for (const id of prevOrder) {
      const el = list.querySelector<HTMLElement>(`[data-filter-options-row="${id}"]`);
      if (el) firstRects.set(id, el.getBoundingClientRect());
    }

    for (const id of order) {
      const el = list.querySelector<HTMLElement>(`[data-filter-options-row="${id}"]`);
      const first = firstRects.get(id);
      if (!el || !first) continue;
      const last = el.getBoundingClientRect();
      const dy = first.top - last.top;
      if (Math.abs(dy) < 0.5) continue;
      gsap.fromTo(
        el,
        { y: dy },
        { y: 0, duration, ease: arcMotionTokens.ease, overwrite: true }
      );
    }
  }, [listRef, order, isDragging]);
}
