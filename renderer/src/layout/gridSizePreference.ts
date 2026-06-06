import { useCallback, useEffect, useState } from 'react';

export type GridSize = 'l' | 'm' | 's';

export const GRID_SIZE_DEFAULT: GridSize = 'm';
export const GRID_SIZE_STORAGE_KEY = 'arc2.gridSize';
export const ARC_GRID_SIZE_CHANGED_EVENT = 'arc:grid-size-changed';

const GRID_SIZE_VALUES: readonly GridSize[] = ['l', 'm', 's'];

function isGridSize(value: unknown): value is GridSize {
  return typeof value === 'string' && (GRID_SIZE_VALUES as readonly string[]).includes(value);
}

export function readGridSize(): GridSize {
  if (typeof window === 'undefined' || !window.localStorage) return GRID_SIZE_DEFAULT;
  try {
    const raw = window.localStorage.getItem(GRID_SIZE_STORAGE_KEY);
    return isGridSize(raw) ? raw : GRID_SIZE_DEFAULT;
  } catch {
    return GRID_SIZE_DEFAULT;
  }
}

export function applyGridSizeToDocument(size: GridSize): void {
  if (typeof document === 'undefined') return;
  document.body.dataset.gridSize = size;
}

export function writeGridSize(size: GridSize): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(GRID_SIZE_STORAGE_KEY, size);
  applyGridSizeToDocument(size);
  window.dispatchEvent(new CustomEvent(ARC_GRID_SIZE_CHANGED_EVENT, { detail: { size } }));
}

export function useGridSize(): [GridSize, (size: GridSize) => void] {
  const [size, setSize] = useState<GridSize>(() => readGridSize());

  useEffect(() => {
    applyGridSizeToDocument(size);
  }, [size]);

  useEffect(() => {
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<{ size?: GridSize }>).detail?.size;
      if (isGridSize(next)) {
        setSize(next);
        return;
      }
      setSize(readGridSize());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== GRID_SIZE_STORAGE_KEY) return;
      setSize(readGridSize());
    };
    window.addEventListener(ARC_GRID_SIZE_CHANGED_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(ARC_GRID_SIZE_CHANGED_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setGridSize = useCallback((next: GridSize) => {
    writeGridSize(next);
    setSize(next);
  }, []);

  return [size, setGridSize];
}
