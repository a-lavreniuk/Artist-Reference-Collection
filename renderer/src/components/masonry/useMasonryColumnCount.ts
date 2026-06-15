import { useCallback, useEffect, useRef, useState } from 'react';
import { ARC_GRID_SIZE_CHANGED_EVENT, readGridSize, type GridSize } from '../../layout/gridSizePreference';
import { resolveMasonryColumnCount } from './masonryColumnRules';
import type { MasonryVariant } from './masonryTypes';

export function useMasonryColumnCount(
  containerWidth: number,
  variant: MasonryVariant
): { columnCount: number; gridSize: GridSize; layoutEpoch: number } {
  const [gridSize, setGridSize] = useState<GridSize>(() => readGridSize());
  const [layoutEpoch, setLayoutEpoch] = useState(0);

  useEffect(() => {
    const onGridSizeChanged = () => {
      setGridSize(readGridSize());
      setLayoutEpoch((v) => v + 1);
    };
    window.addEventListener(ARC_GRID_SIZE_CHANGED_EVENT, onGridSizeChanged);
    return () => window.removeEventListener(ARC_GRID_SIZE_CHANGED_EVENT, onGridSizeChanged);
  }, []);

  const columnCount = resolveMasonryColumnCount(containerWidth, gridSize, variant);

  return { columnCount, gridSize, layoutEpoch };
}

export function useContainerWidth(containerRef: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      setWidth(el.clientWidth);
    };
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  return width;
}

export function useScrollRatioCapture(scrollRoot: HTMLElement | null): {
  captureRatio: () => void;
  restoreRatio: () => void;
} {
  const ratioRef = useRef<number | null>(null);

  const captureRatio = useCallback(() => {
    if (!scrollRoot) return;
    const max = scrollRoot.scrollHeight - scrollRoot.clientHeight;
    ratioRef.current = max > 0 ? scrollRoot.scrollTop / max : 0;
  }, [scrollRoot]);

  const restoreRatio = useCallback(() => {
    if (!scrollRoot || ratioRef.current === null) return;
    requestAnimationFrame(() => {
      const max = scrollRoot.scrollHeight - scrollRoot.clientHeight;
      scrollRoot.scrollTop = max > 0 ? ratioRef.current! * max : 0;
    });
  }, [scrollRoot]);

  return { captureRatio, restoreRatio };
}
