import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react';
import {
  ZOOM_WHEEL_FACTOR,
  canPan,
  computeFitScale,
  isViewportAtActual,
  isViewportAtFit,
  normalizeViewport,
  scaleToDisplayPct,
  setDisplayPctAtCenter,
  setScaleAtCenter,
  viewportAtActualSize,
  zoomAtPoint,
  type NaturalSize,
  type StageSize,
  type ViewportPan
} from './imageViewportZoomMath';

type PanDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

type PinchState = {
  pointerIds: [number, number];
  startDistance: number;
  startScale: number;
  midpointX: number;
  midpointY: number;
  origin: ViewportPan;
};

const EMPTY_NATURAL: NaturalSize = { width: 0, height: 0 };
const EMPTY_STAGE: StageSize = { width: 0, height: 0 };

export function useImageViewportZoom(resetKey: string) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState<StageSize>(EMPTY_STAGE);
  const [naturalSize, setNaturalSize] = useState<NaturalSize>(EMPTY_NATURAL);
  const [viewport, setViewport] = useState<ViewportPan>({ scale: 1, panX: 0, panY: 0 });
  const panDragRef = useRef<PanDragState | null>(null);
  const pinchRef = useRef<PinchState | null>(null);
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());

  const fitScale = useMemo(
    () => computeFitScale(stageSize, naturalSize),
    [naturalSize.height, naturalSize.width, stageSize.height, stageSize.width]
  );

  const displayScalePct = useMemo(
    () => scaleToDisplayPct(viewport.scale, fitScale),
    [fitScale, viewport.scale]
  );

  const panEnabled = useMemo(
    () => canPan(stageSize, naturalSize, viewport.scale, fitScale),
    [fitScale, naturalSize, stageSize, viewport.scale]
  );

  const applyViewport = useCallback(
    (next: ViewportPan) => {
      setViewport(normalizeViewport(stageSize, naturalSize, next, fitScale));
    },
    [fitScale, naturalSize, stageSize]
  );

  const resetToFit = useCallback(() => {
    setViewport({ scale: fitScale, panX: 0, panY: 0 });
  }, [fitScale]);

  const isFitActive = useMemo(
    () => isViewportAtFit(viewport, fitScale),
    [fitScale, viewport]
  );

  const isActualActive = useMemo(() => isViewportAtActual(viewport), [viewport]);

  const resetToActual = useCallback(() => {
    setViewport((current) =>
      viewportAtActualSize(stageSize, naturalSize, current, fitScale)
    );
  }, [fitScale, naturalSize, stageSize]);

  useEffect(() => {
    setNaturalSize(EMPTY_NATURAL);
    setViewport({ scale: 1, panX: 0, panY: 0 });
    panDragRef.current = null;
    pinchRef.current = null;
    activePointersRef.current.clear();
  }, [resetKey]);

  useEffect(() => {
    if (naturalSize.width <= 0 || naturalSize.height <= 0) return;
    setViewport({ scale: fitScale, panX: 0, panY: 0 });
  }, [naturalSize.height, naturalSize.width, resetKey]);

  useEffect(() => {
    if (naturalSize.width <= 0 || naturalSize.height <= 0 || stageSize.width <= 0) return;
    setViewport((current) => {
      const displayPct = scaleToDisplayPct(current.scale, computeFitScale(stageSize, naturalSize));
      const next = setDisplayPctAtCenter(stageSize, naturalSize, current, fitScale, displayPct);
      return normalizeViewport(stageSize, naturalSize, next, fitScale);
    });
  }, [fitScale, naturalSize.height, naturalSize.width, stageSize.height, stageSize.width]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setStageSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const focalFromStage = useCallback((clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }, []);

  const zoomAtClient = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const focal = focalFromStage(clientX, clientY);
      setViewport((current) => {
        const next = zoomAtPoint(stageSize, naturalSize, current, fitScale, focal.x, focal.y, factor);
        return normalizeViewport(stageSize, naturalSize, next, fitScale);
      });
    },
    [fitScale, focalFromStage, naturalSize, stageSize]
  );

  const zoomCenterFactor = useCallback(
    (factor: number) => {
      setViewport((current) => {
        const nextScale = current.scale * factor;
        const next = setScaleAtCenter(stageSize, naturalSize, current, fitScale, nextScale);
        return normalizeViewport(stageSize, naturalSize, next, fitScale);
      });
    },
    [fitScale, naturalSize, stageSize]
  );

  const setDisplayPct = useCallback(
    (displayPct: number) => {
      setViewport((current) => {
        const next = setDisplayPctAtCenter(stageSize, naturalSize, current, fitScale, displayPct);
        return normalizeViewport(stageSize, naturalSize, next, fitScale);
      });
    },
    [fitScale, naturalSize, stageSize]
  );

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = -event.deltaY;
      const factor = delta > 0 ? ZOOM_WHEEL_FACTOR : 1 / ZOOM_WHEEL_FACTOR;
      zoomAtClient(event.clientX, event.clientY, factor);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAtClient]);

  const finishPan = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = panDragRef.current;
    if (drag && drag.pointerId === event.pointerId) {
      panDragRef.current = null;
    }
    activePointersRef.current.delete(event.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchRef.current = null;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (activePointersRef.current.size === 2) {
        panDragRef.current = null;
        const ids = [...activePointersRef.current.keys()].slice(0, 2) as [number, number];
        const p1 = activePointersRef.current.get(ids[0])!;
        const p2 = activePointersRef.current.get(ids[1])!;
        const midpoint = focalFromStage((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
        const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        pinchRef.current = {
          pointerIds: ids,
          startDistance: Math.max(distance, 1),
          startScale: viewport.scale,
          midpointX: midpoint.x,
          midpointY: midpoint.y,
          origin: viewport
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }

      if (!panEnabled || event.button !== 0 || pinchRef.current) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      panDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: viewport.panX,
        originY: viewport.panY
      };
    },
    [focalFromStage, panEnabled, viewport]
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (activePointersRef.current.has(event.pointerId)) {
        activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }

      const pinch = pinchRef.current;
      if (pinch && activePointersRef.current.size >= 2) {
        const p1 = activePointersRef.current.get(pinch.pointerIds[0]);
        const p2 = activePointersRef.current.get(pinch.pointerIds[1]);
        if (!p1 || !p2) return;
        event.preventDefault();
        const distance = Math.max(Math.hypot(p2.x - p1.x, p2.y - p1.y), 1);
        const factor = distance / pinch.startDistance;
        const next = zoomAtPoint(
          stageSize,
          naturalSize,
          pinch.origin,
          fitScale,
          pinch.midpointX,
          pinch.midpointY,
          factor
        );
        applyViewport(next);
        return;
      }

      const drag = panDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      applyViewport({
        scale: viewport.scale,
        panX: drag.originX + (event.clientX - drag.startX),
        panY: drag.originY + (event.clientY - drag.startY)
      });
    },
    [applyViewport, fitScale, naturalSize, stageSize, viewport.scale]
  );

  const onImageLoad = useCallback((width: number, height: number) => {
    setNaturalSize({ width, height });
  }, []);

  const mediaTransformStyle = useMemo(() => {
    const dispW = naturalSize.width * viewport.scale;
    const dispH = naturalSize.height * viewport.scale;
    const baseX = (stageSize.width - dispW) / 2 + viewport.panX;
    const baseY = (stageSize.height - dispH) / 2 + viewport.panY;
    return {
      width: dispW,
      height: dispH,
      transform: `translate(${baseX}px, ${baseY}px)`
    };
  }, [
    naturalSize.height,
    naturalSize.width,
    stageSize.height,
    stageSize.width,
    viewport.panX,
    viewport.panY,
    viewport.scale
  ]);

  return {
    stageRef,
    naturalSize,
    displayScalePct,
    isFitActive,
    isActualActive,
    panEnabled,
    mediaTransformStyle,
    onImageLoad,
    zoomCenterFactor,
    setDisplayPct,
    resetToFit,
    resetToActual,
    stageHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishPan,
      onPointerCancel: finishPan,
      onLostPointerCapture: finishPan
    }
  };
}
