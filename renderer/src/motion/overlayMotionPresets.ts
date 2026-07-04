import type { OverlayMotionPreset } from './arcMotionTokens';

export type OverlayMotionFrom = {
  opacity: number;
  scale?: number;
  y?: number;
};

export function overlayMotionFrom(preset: OverlayMotionPreset): OverlayMotionFrom {
  switch (preset) {
    case 'fade':
      return { opacity: 0 };
    case 'fade-scale':
      return { opacity: 0, scale: 0.98 };
    case 'fade-slide-down':
      return { opacity: 0, y: -6 };
    case 'fade-slide-up':
      return { opacity: 0, y: 8 };
    case 'fade-slide-down-notice':
      return { opacity: 0, y: -10 };
    default:
      return { opacity: 0 };
  }
}
