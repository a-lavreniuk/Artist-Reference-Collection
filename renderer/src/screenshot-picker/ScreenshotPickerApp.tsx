import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hydrateArcNavbarIcons } from '../components/layout/navbarIconHydrate';

type Point = { x: number; y: number };

export type ScreenshotRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const MIN_SIZE = 8;

function normalizeRect(start: Point, end: Point): ScreenshotRegion {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return { x, y, width, height };
}

function clampToolbarTop(selectionBottom: number, toolbarHeight: number): number {
  const margin = 8;
  const maxTop = window.innerHeight - toolbarHeight - margin;
  return Math.max(margin, Math.min(selectionBottom + margin, maxTop));
}

export default function ScreenshotPickerApp() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [dragEnd, setDragEnd] = useState<Point | null>(null);
  const [selection, setSelection] = useState<ScreenshotRegion | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const draft = useMemo(() => {
    if (!dragStart || !dragEnd) return null;
    return normalizeRect(dragStart, dragEnd);
  }, [dragStart, dragEnd]);

  const activeRegion = isDragging ? draft : selection;
  const canSave = !!selection && selection.width >= MIN_SIZE && selection.height >= MIN_SIZE;

  const cancel = useCallback(() => {
    void window.arc?.screenshotPickerCancel?.();
  }, []);

  const save = useCallback(() => {
    if (!canSave || !selection) return;
    void window.arc?.screenshotPickerConfirm?.(selection);
  }, [canSave, selection]);

  useEffect(() => {
    if (rootRef.current) void hydrateArcNavbarIcons(rootRef.current);
  }, [canSave]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cancel]);

  const clientPoint = (event: React.PointerEvent): Point => ({
    x: event.clientX,
    y: event.clientY
  });

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('.arc-screenshot-picker__toolbar')) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    const point = clientPoint(event);
    setDragStart(point);
    setDragEnd(point);
    setSelection(null);
    setIsDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStart) return;
    setDragEnd(clientPoint(event));
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStart || !dragEnd) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const next = normalizeRect(dragStart, dragEnd);
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
    if (next.width >= MIN_SIZE && next.height >= MIN_SIZE) {
      setSelection(next);
    } else {
      setSelection(null);
    }
  };

  const toolbarStyle = useMemo(() => {
    if (!selection) return undefined;
    const toolbarHeight = 40;
    const centerX = selection.x + selection.width / 2;
    const top = clampToolbarTop(selection.y + selection.height, toolbarHeight);
    return {
      top,
      left: Math.max(8, Math.min(centerX, window.innerWidth - 8)),
      transform: 'translateX(-50%)'
    } as const;
  }, [selection]);

  return (
    <div
      ref={rootRef}
      className="arc-screenshot-picker arc-ui-kit-scope"
      data-elevation="sunken"
      data-btn-size="m"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      role="application"
      aria-label="Выбор области скриншота"
    >
      {activeRegion && activeRegion.width > 0 && activeRegion.height > 0 ? (
        <div
          className="arc-screenshot-picker__selection"
          style={{
            left: activeRegion.x,
            top: activeRegion.y,
            width: activeRegion.width,
            height: activeRegion.height
          }}
        />
      ) : null}

      {canSave && toolbarStyle ? (
        <div className="arc-screenshot-picker__toolbar" style={toolbarStyle}>
          <button type="button" className="btn btn-secondary btn-ds btn-m" onClick={cancel}>
            <span className="btn-ds__value">Отмена</span>
          </button>
          <button type="button" className="btn btn-brand btn-ds btn-m" onClick={save}>
            <span className="btn-ds__value">Сохранить скриншот</span>
            <span className="btn-ds__icon arc-icon-save" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
