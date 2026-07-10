import type { CSSProperties } from 'react';

export type ViewerZoomMode =
  | { kind: 'fit' }
  | { kind: 'actual' }
  | { kind: 'scale'; factor: number };

export const VIEWER_ZOOM_PRESETS = [0.5, 0.75, 1, 1.5, 2] as const;

export function viewerZoomLabel(mode: ViewerZoomMode): string {
  if (mode.kind === 'fit') return 'Вписать';
  if (mode.kind === 'actual') return '100%';
  return `${Math.round(mode.factor * 100)}%`;
}

export function viewerZoomMediaStyle(
  mode: ViewerZoomMode,
  naturalWidth: number,
  naturalHeight: number
): CSSProperties {
  if (mode.kind === 'fit') {
    return {
      maxWidth: '100%',
      maxHeight: '100%',
      width: 'auto',
      height: 'auto',
      objectFit: 'contain'
    };
  }

  const baseW = naturalWidth > 0 ? naturalWidth : undefined;
  const baseH = naturalHeight > 0 ? naturalHeight : undefined;

  if (mode.kind === 'actual') {
    return {
      width: baseW,
      height: baseH,
      maxWidth: 'none',
      maxHeight: 'none'
    };
  }

  return {
    width: baseW ? baseW * mode.factor : undefined,
    height: baseH ? baseH * mode.factor : undefined,
    maxWidth: 'none',
    maxHeight: 'none'
  };
}
