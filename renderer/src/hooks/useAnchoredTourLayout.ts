import { useCallback, useLayoutEffect, useState, type RefObject } from 'react';
import { CONTEXT_MENU_ANCHOR_GAP } from '../components/context-menu/types';
import type { InterfaceTourPlacement } from '../content/onboardingTour';

/** Отступ модалки от якоря — как у ContextMenu (`--s-2`, 8px). */
const ANCHOR_GAP = CONTEXT_MENU_ANCHOR_GAP;
const VIEW_MARGIN = CONTEXT_MENU_ANCHOR_GAP;

export type AnchoredTourLayout = {
  top: number;
  left: number;
  placement: InterfaceTourPlacement;
};

function flipOrder(preferred: InterfaceTourPlacement): InterfaceTourPlacement[] {
  switch (preferred) {
    case 'top':
      return ['top', 'bottom', 'right', 'left'];
    case 'bottom':
      return ['bottom', 'top', 'right', 'left'];
    case 'left':
      return ['left', 'right', 'bottom', 'top'];
    case 'right':
      return ['right', 'left', 'bottom', 'top'];
    default:
      return ['bottom', 'top', 'right', 'left'];
  }
}

function placeAt(
  anchorRect: DOMRect,
  modalWidth: number,
  modalHeight: number,
  placement: InterfaceTourPlacement,
  gap = ANCHOR_GAP
): { top: number; left: number } {
  switch (placement) {
    case 'top':
      return {
        top: anchorRect.top - modalHeight - gap,
        left: anchorRect.left + (anchorRect.width - modalWidth) / 2
      };
    case 'bottom':
      return {
        top: anchorRect.bottom + gap,
        left: anchorRect.left + (anchorRect.width - modalWidth) / 2
      };
    case 'left':
      return {
        top: anchorRect.top + (anchorRect.height - modalHeight) / 2,
        left: anchorRect.left - modalWidth - gap
      };
    case 'right':
      return {
        top: anchorRect.top + (anchorRect.height - modalHeight) / 2,
        left: anchorRect.right + gap
      };
    default:
      return placeAt(anchorRect, modalWidth, modalHeight, 'bottom', gap);
  }
}

function fitsInViewport(top: number, left: number, width: number, height: number, margin: number): boolean {
  return (
    top >= margin &&
    left >= margin &&
    top + height <= window.innerHeight - margin &&
    left + width <= window.innerWidth - margin
  );
}

function clampToViewport(
  top: number,
  left: number,
  width: number,
  height: number,
  margin: number
): { top: number; left: number } {
  const maxLeft = Math.max(margin, window.innerWidth - width - margin);
  const maxTop = Math.max(margin, window.innerHeight - height - margin);
  return {
    top: Math.max(margin, Math.min(top, maxTop)),
    left: Math.max(margin, Math.min(left, maxLeft))
  };
}

export function computeAnchoredTourLayout(
  anchorEl: HTMLElement,
  modalEl: HTMLElement,
  preferredPlacement: InterfaceTourPlacement
): AnchoredTourLayout | null {
  const anchorRect = anchorEl.getBoundingClientRect();
  const modalRect = modalEl.getBoundingClientRect();
  const modalWidth = modalRect.width;
  const modalHeight = modalRect.height;

  if (modalWidth <= 0 || modalHeight <= 0) return null;

  for (const placement of flipOrder(preferredPlacement)) {
    const candidate = placeAt(anchorRect, modalWidth, modalHeight, placement);
    if (fitsInViewport(candidate.top, candidate.left, modalWidth, modalHeight, VIEW_MARGIN)) {
      return { ...candidate, placement };
    }
  }

  const primary = placeAt(anchorRect, modalWidth, modalHeight, preferredPlacement);
  const clamped = clampToViewport(primary.top, primary.left, modalWidth, modalHeight, VIEW_MARGIN);
  return { ...clamped, placement: preferredPlacement };
}

export function useAnchoredTourLayout(
  open: boolean,
  anchorEl: HTMLElement | null,
  modalRef: RefObject<HTMLElement | null>,
  placement: InterfaceTourPlacement
): AnchoredTourLayout | null {
  const [layout, setLayout] = useState<AnchoredTourLayout | null>(null);

  const updateLayout = useCallback(() => {
    const modalEl = modalRef.current;
    if (!open || !anchorEl || !modalEl) {
      setLayout(null);
      return;
    }

    const next = computeAnchoredTourLayout(anchorEl, modalEl, placement);
    if (!next) return;

    setLayout((prev) => {
      if (
        prev &&
        prev.top === next.top &&
        prev.left === next.left &&
        prev.placement === next.placement
      ) {
        return prev;
      }
      return next;
    });
  }, [anchorEl, modalRef, open, placement]);

  useLayoutEffect(() => {
    if (!open || !anchorEl) {
      setLayout(null);
      return;
    }

    setLayout(null);
    let cancelled = false;
    let raf2 = 0;

    const run = () => {
      if (!cancelled) updateLayout();
    };

    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(run);
    });

    const modalEl = modalRef.current;
    const roModal =
      modalEl && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (!cancelled) updateLayout();
          })
        : null;
    roModal?.observe(modalEl as Element);

    const roAnchor =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (!cancelled) updateLayout();
          })
        : null;
    roAnchor?.observe(anchorEl);

    window.addEventListener('scroll', updateLayout, true);
    window.addEventListener('resize', updateLayout);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      roModal?.disconnect();
      roAnchor?.disconnect();
      window.removeEventListener('scroll', updateLayout, true);
      window.removeEventListener('resize', updateLayout);
    };
  }, [anchorEl, modalRef, open, placement, updateLayout]);

  return layout;
}
