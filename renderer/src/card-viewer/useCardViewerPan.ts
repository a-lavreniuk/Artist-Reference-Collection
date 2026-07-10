import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

type PanOffset = { x: number; y: number };

type PanDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

export function useCardViewerPan(enabled: boolean, resetKey: string) {
  const [offset, setOffset] = useState<PanOffset>({ x: 0, y: 0 });
  const dragRef = useRef<PanDragState | null>(null);

  useEffect(() => {
    setOffset({ x: 0, y: 0 });
    dragRef.current = null;
  }, [enabled, resetKey]);

  const finishPan = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0) return;
      if (event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: offset.x,
        originY: offset.y
      };
    },
    [enabled, offset.x, offset.y]
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    setOffset({
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY)
    });
  }, []);

  return {
    offset,
    panHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishPan,
      onPointerCancel: finishPan,
      onLostPointerCapture: finishPan
    }
  };
}
