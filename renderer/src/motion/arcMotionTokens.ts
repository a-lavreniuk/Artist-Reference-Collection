/** Mirrors ARC CSS tokens: --transition-fast/base/slow in arc-ui.css */

export const ARC_MOTION_EASE = 'power2.out';

export const arcMotionTokens = {
  fast: 0.15,
  base: 0.25,
  slow: 0.35,
  ease: ARC_MOTION_EASE,
  stagger: 0.04
} as const;

export type OverlayMotionPreset =
  | 'fade'
  | 'fade-scale'
  | 'fade-slide-down'
  | 'fade-slide-up'
  | 'fade-slide-down-notice';

export function motionDuration(
  token: keyof Pick<typeof arcMotionTokens, 'fast' | 'base' | 'slow'>,
  reduced: boolean
): number {
  return reduced ? 0 : arcMotionTokens[token];
}
