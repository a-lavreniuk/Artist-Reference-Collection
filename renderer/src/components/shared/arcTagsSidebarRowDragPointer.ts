import type { MutableRefObject, PointerEvent as ReactPointerEvent } from 'react';

const DRAG_THRESHOLD_PX = 4;

export type ArcTagsSidebarRowDragStartArgs = {
  id: string;
  label: string;
  count: number;
  handleEl: HTMLElement;
  rowEl: HTMLElement;
  listEl: HTMLElement;
};

type BindArgs = {
  e: ReactPointerEvent<HTMLElement>;
  listEl: HTMLElement | null;
  rowSelector: string;
  id: string;
  label: string;
  count: number;
  onStartDrag: (args: ArcTagsSidebarRowDragStartArgs) => void;
  skipClickRef: MutableRefObject<boolean>;
};

export function bindArcTagsSidebarRowPointerDown({
  e,
  listEl,
  rowSelector,
  id,
  label,
  count,
  onStartDrag,
  skipClickRef
}: BindArgs): void {
  if (e.button !== 0 || !listEl) return;

  const selectEl = e.currentTarget;
  const rowEl = selectEl.closest(rowSelector);
  if (!(rowEl instanceof HTMLElement)) return;

  const originX = e.clientX;
  const originY = e.clientY;
  let started = false;

  const onMove = (ev: PointerEvent) => {
    if (started) return;
    if (Math.hypot(ev.clientX - originX, ev.clientY - originY) < DRAG_THRESHOLD_PX) return;
    started = true;
    skipClickRef.current = true;
    try {
      selectEl.setPointerCapture(ev.pointerId);
    } catch {
      /* already released */
    }
    onStartDrag({
      id,
      label,
      count,
      handleEl: selectEl,
      rowEl,
      listEl
    });
  };

  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}
