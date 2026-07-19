import { useCallback, useEffect, useState } from 'react';

export type GalleryLayoutMode = 'masonry' | 'grid' | 'list';

export const GALLERY_LAYOUT_DEFAULT: GalleryLayoutMode = 'masonry';
export const GALLERY_LAYOUT_STORAGE_KEY = 'arc2.galleryLayout';
export const ARC_GALLERY_LAYOUT_CHANGED_EVENT = 'arc:gallery-layout-changed';

const GALLERY_LAYOUT_VALUES: readonly GalleryLayoutMode[] = ['masonry', 'grid', 'list'];

export function isGalleryLayoutMode(value: unknown): value is GalleryLayoutMode {
  return typeof value === 'string' && (GALLERY_LAYOUT_VALUES as readonly string[]).includes(value);
}

export function readGalleryLayoutMode(): GalleryLayoutMode {
  if (typeof window === 'undefined' || !window.localStorage) return GALLERY_LAYOUT_DEFAULT;
  try {
    const raw = window.localStorage.getItem(GALLERY_LAYOUT_STORAGE_KEY);
    return isGalleryLayoutMode(raw) ? raw : GALLERY_LAYOUT_DEFAULT;
  } catch {
    return GALLERY_LAYOUT_DEFAULT;
  }
}

export function applyGalleryLayoutToDocument(mode: GalleryLayoutMode): void {
  if (typeof document === 'undefined') return;
  document.body.dataset.galleryLayout = mode;
}

export function writeGalleryLayoutMode(mode: GalleryLayoutMode): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(GALLERY_LAYOUT_STORAGE_KEY, mode);
  applyGalleryLayoutToDocument(mode);
  window.dispatchEvent(new CustomEvent(ARC_GALLERY_LAYOUT_CHANGED_EVENT, { detail: { mode } }));
}

export function useGalleryLayoutMode(): [GalleryLayoutMode, (mode: GalleryLayoutMode) => void] {
  const [mode, setMode] = useState<GalleryLayoutMode>(() => readGalleryLayoutMode());

  useEffect(() => {
    applyGalleryLayoutToDocument(mode);
  }, [mode]);

  useEffect(() => {
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<{ mode?: GalleryLayoutMode }>).detail?.mode;
      if (isGalleryLayoutMode(next)) {
        setMode(next);
        return;
      }
      setMode(readGalleryLayoutMode());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== GALLERY_LAYOUT_STORAGE_KEY) return;
      setMode(readGalleryLayoutMode());
    };
    window.addEventListener(ARC_GALLERY_LAYOUT_CHANGED_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(ARC_GALLERY_LAYOUT_CHANGED_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setGalleryLayoutMode = useCallback((next: GalleryLayoutMode) => {
    writeGalleryLayoutMode(next);
    setMode(next);
  }, []);

  return [mode, setGalleryLayoutMode];
}
