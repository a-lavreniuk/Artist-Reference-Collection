import { useCallback, useEffect, useRef, type RefObject } from 'react';
import {
  computeMarqueeSelection,
  idsIntersectingRect,
  normalizeSelectionRect,
  resolveMarqueeMode,
  setsEqual,
  type MarqueeMode,
  type SelectionRect
} from './galleryCardSelectionCore';
import type { MarqueeView } from './GalleryMarqueeOverlay';

export type { MarqueeMode };

type Options = {
  boardRef: RefObject<HTMLElement | null>;
  scrollRootRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  /** Выделение на момент начала протягивания — база для add / subtract. */
  getSelectedIds: () => ReadonlySet<string>;
  onSelectionChange: (cardIds: Set<string>) => void;
  /** Клик по пустому месту без протягивания. */
  onEmptyClick: () => void;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  /** Начало по вертикали в координатах ленты — не съезжает при прокрутке. */
  startDocY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  mode: MarqueeMode;
  base: Set<string>;
  /** Карточки внутри рамки на текущем кадре, включая уже размонтированные при прокрутке. */
  inside: Set<string>;
};

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 8;
const MARQUEE_DRAG_THRESHOLD_PX = 4;
const MARQUEE_DRAGGING_CLASS = 'arc-gallery-marquee-dragging';

/**
 * Рамку можно тянуть из любого места окна, кроме карточек, управляющих элементов,
 * полосы перетаскивания окна, боковых списков со своим drag-and-drop и оверлеев.
 */
const MARQUEE_BLOCKED_SELECTOR = [
  '[data-gallery-card-id]',
  '.arc-topbar',
  '.arc-gallery-selection-bar',
  '.arc-gallery-collections-strip',
  '.arc-modal-host',
  '.arc-card-detail-overlay',
  '.context-menu:not(.context-menu--static)',
  '.arc-collections-page-sidebar',
  '.arc-tags-page-sidebar',
  '.arc-settings-page-sidebar',
  'button',
  'a',
  'input',
  'textarea',
  'select',
  'label',
  '[draggable="true"]',
  '[role="button"]',
  '[role="menuitem"]',
  '[role="slider"]',
  '[role="tab"]'
].join(', ');

/** Тянут полосу прокрутки, а не рамку. */
function isScrollbarHit(event: PointerEvent, target: Element): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const rect = target.getBoundingClientRect();
  if (target.scrollHeight > target.clientHeight && event.clientX >= rect.left + target.clientWidth) {
    return true;
  }
  if (target.scrollWidth > target.clientWidth && event.clientY >= rect.top + target.clientHeight) {
    return true;
  }
  return false;
}

export function useGalleryMarqueeSelection({
  boardRef,
  scrollRootRef,
  enabled,
  getSelectedIds,
  onSelectionChange,
  onEmptyClick
}: Options) {
  const dragRef = useRef<DragState | null>(null);
  const appliedRef = useRef<Set<string>>(new Set());
  const viewListenerRef = useRef<((view: MarqueeView) => void) | null>(null);

  const getSelectedIdsRef = useRef(getSelectedIds);
  getSelectedIdsRef.current = getSelectedIds;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const onEmptyClickRef = useRef(onEmptyClick);
  onEmptyClickRef.current = onEmptyClick;

  const subscribeMarquee = useCallback((listener: (view: MarqueeView) => void) => {
    viewListenerRef.current = listener;
    return () => {
      if (viewListenerRef.current === listener) viewListenerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    const EDGE = 72;
    const maxStep = 24;
    let rafId = 0;
    let applyRafId = 0;
    let edgeVy = 0;
    /**
     * Геометрия карточек в координатах ленты (viewport + прокрутка), поэтому замер
     * нужен один раз на карточку: при прокрутке и размонтировании он не устаревает.
     */
    const rectCache = new Map<string, SelectionRect>();

    const scrollOffset = () => scrollRootRef.current?.scrollTop ?? 0;

    /** Домеряет только карточки, которых ещё нет в кэше. */
    const measureNewCards = () => {
      const root = boardRef.current;
      if (!root) return;
      // Без контейнера прокрутки координаты кэшировать нельзя — меряем заново.
      if (!scrollRootRef.current) rectCache.clear();
      const offset = scrollOffset();
      const nodes = root.querySelectorAll<HTMLElement>('[data-gallery-card-id]');
      for (const node of nodes) {
        const id = node.dataset.galleryCardId;
        if (!id || rectCache.has(id)) continue;
        const rect = node.getBoundingClientRect();
        rectCache.set(id, {
          left: rect.left,
          right: rect.right,
          top: rect.top + offset,
          bottom: rect.bottom + offset
        });
      }
    };

    /** Пересчёт попаданий и выделения по текущему прямоугольнику. */
    const applyDrag = () => {
      const drag = dragRef.current;
      if (!drag) return;
      measureNewCards();
      const offset = scrollOffset();
      // Начало рамки закреплено за контентом: при автопрокрутке выделение копится.
      const docRect = normalizeSelectionRect(
        drag.startX,
        drag.startDocY,
        drag.lastX,
        drag.lastY + offset
      );
      drag.inside = new Set(idsIntersectingRect(rectCache, docRect));
      const next = computeMarqueeSelection(drag.base, drag.inside, drag.mode);
      if (!setsEqual(next, appliedRef.current)) {
        appliedRef.current = next;
        onSelectionChangeRef.current(next);
      }
      viewListenerRef.current?.({
        rect: {
          left: docRect.left,
          right: docRect.right,
          top: docRect.top - offset,
          bottom: docRect.bottom - offset
        },
        mode: drag.mode
      });
    };

    const scheduleApply = () => {
      if (applyRafId) return;
      applyRafId = window.requestAnimationFrame(() => {
        applyRafId = 0;
        applyDrag();
      });
    };

    const step = () => {
      const scrollEl = scrollRootRef.current;
      if (edgeVy !== 0 && scrollEl) {
        scrollEl.scrollTop += edgeVy;
        scheduleApply();
      }
      if (edgeVy !== 0) {
        rafId = window.requestAnimationFrame(step);
      } else {
        rafId = 0;
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
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

      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      drag.mode = resolveMarqueeMode(event);
      if (
        Math.abs(drag.lastX - drag.startX) >= MARQUEE_DRAG_THRESHOLD_PX ||
        Math.abs(drag.lastY - drag.startY) >= MARQUEE_DRAG_THRESHOLD_PX
      ) {
        drag.moved = true;
      }
      scheduleApply();
    };

    /** Ctrl / Alt можно зажать и отпустить прямо во время протягивания. */
    const onModifierChange = (event: KeyboardEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const nextMode = resolveMarqueeMode(event);
      if (nextMode === drag.mode) return;
      drag.mode = nextMode;
      scheduleApply();
    };

    const stopDrag = () => {
      dragRef.current = null;
      appliedRef.current = new Set();
      rectCache.clear();
      viewListenerRef.current?.(null);
      edgeVy = 0;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (applyRafId) {
        window.cancelAnimationFrame(applyRafId);
        applyRafId = 0;
      }
      document.body.classList.remove(MARQUEE_DRAGGING_CLASS);
    };

    const finishDrag = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      drag.mode = resolveMarqueeMode(event);
      if (drag.moved) {
        applyDrag();
      } else if (drag.mode === 'replace') {
        onEmptyClickRef.current();
      }
      stopDrag();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const body = document.body;
      // Поверх деталки и панели поиска рамка ленты не работает.
      if (
        body.classList.contains('arc-card-detail-open') ||
        body.classList.contains('arc-search-panel-open')
      ) {
        return;
      }
      if (target.closest(MARQUEE_BLOCKED_SELECTOR)) return;
      if (isScrollbarHit(event, target)) return;

      const mode = resolveMarqueeMode(event);
      // Раскладка между протягиваниями могла измениться — меряем заново.
      rectCache.clear();
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startDocY: event.clientY + scrollOffset(),
        lastX: event.clientX,
        lastY: event.clientY,
        moved: false,
        mode,
        base: new Set(getSelectedIdsRef.current()),
        inside: new Set()
      };
      appliedRef.current = new Set(getSelectedIdsRef.current());
      document.body.classList.add(MARQUEE_DRAGGING_CLASS);
      event.preventDefault();
    };

    /** Кнопку отпустили вне окна — выделение уже применено, просто выходим из режима. */
    const onWindowBlur = () => {
      if (dragRef.current) stopDrag();
    };

    // Слушаем всё окно: рамка стартует и с навбара, и с отступов вокруг ленты.
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    window.addEventListener('keydown', onModifierChange);
    window.addEventListener('keyup', onModifierChange);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
      window.removeEventListener('keydown', onModifierChange);
      window.removeEventListener('keyup', onModifierChange);
      edgeVy = 0;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (applyRafId) window.cancelAnimationFrame(applyRafId);
      dragRef.current = null;
      viewListenerRef.current?.(null);
      document.body.classList.remove(MARQUEE_DRAGGING_CLASS);
    };
  }, [boardRef, enabled, scrollRootRef]);

  return { subscribeMarquee };
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
