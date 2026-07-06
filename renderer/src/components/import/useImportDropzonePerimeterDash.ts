import { useEffect, type RefObject } from 'react';
import type { Tween } from 'gsap';

import { arcMotionTokens } from '../../motion/arcMotionTokens';
import { ensureGsapSetup } from '../../motion/gsapSetup';
import { getPrefersReducedMotion } from '../../motion/prefersReducedMotion';

const PERIMETER_LOOP_SEC = arcMotionTokens.slow * 6;

function readPxVar(styles: CSSStyleDeclaration, name: string, fallback: number): number {
  const raw = styles.getPropertyValue(name).trim();
  if (!raw) return fallback;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function useImportDropzonePerimeterDash(options: {
  enabled: boolean;
  dropzoneRef: RefObject<HTMLDivElement | null>;
  borderRectRef: RefObject<SVGRectElement | null>;
}): void {
  const { enabled, dropzoneRef, borderRectRef } = options;

  useEffect(() => {
    if (!enabled) return undefined;

    const dropzone = dropzoneRef.current;
    const borderRect = borderRectRef.current;
    if (!dropzone || !borderRect) return undefined;

    const gsap = ensureGsapSetup();
    let tween: Tween | null = null;

    const syncAndAnimate = (): void => {
      const { width, height } = dropzone.getBoundingClientRect();
      if (width <= 1 || height <= 1) return;

      const styles = getComputedStyle(dropzone);
      const radius = readPxVar(styles, 'border-radius', 8);
      const dash = readPxVar(styles, '--import-dropzone-dash', 32);
      const gap = readPxVar(styles, '--import-dropzone-gap', 16);
      const period = dash + gap;

      borderRect.setAttribute('x', '0.5');
      borderRect.setAttribute('y', '0.5');
      borderRect.setAttribute('width', String(Math.max(0, width - 1)));
      borderRect.setAttribute('height', String(Math.max(0, height - 1)));
      borderRect.setAttribute('rx', String(radius));
      borderRect.setAttribute('ry', String(radius));

      gsap.killTweensOf(borderRect);
      borderRect.style.strokeDasharray = `${dash} ${gap}`;
      borderRect.style.strokeDashoffset = '0';

      if (getPrefersReducedMotion()) return;

      tween = gsap.to(borderRect, {
        strokeDashoffset: -period,
        duration: PERIMETER_LOOP_SEC,
        ease: 'none',
        repeat: -1
      });
    };

    syncAndAnimate();

    const ro = new ResizeObserver(() => {
      syncAndAnimate();
    });
    ro.observe(dropzone);

    return () => {
      ro.disconnect();
      tween?.kill();
      gsap.killTweensOf(borderRect);
    };
  }, [enabled, dropzoneRef, borderRectRef]);
}
