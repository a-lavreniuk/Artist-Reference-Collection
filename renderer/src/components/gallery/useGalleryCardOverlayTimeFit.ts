import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { shouldHideOverlayTime } from './galleryCardOverlayTimeFit';

type Args = {
  enabled: boolean;
  controlsRef: RefObject<HTMLElement | null>;
  badgeRef: RefObject<HTMLElement | null>;
  timeRef: RefObject<HTMLElement | null>;
  rightRef: RefObject<HTMLElement | null>;
  /** Пересчёт при смене подписи времени / кнопок / размера сетки. */
  layoutKey: string;
};

function readGapPx(el: HTMLElement | null, fallback: number): number {
  if (!el) return fallback;
  const raw = Number.parseFloat(getComputedStyle(el).gap || '');
  return Number.isFinite(raw) ? raw : fallback;
}

/**
 * Скрывает счётчик времени на оверлее карточки, когда ряд controls
 * не помещается по ширине (ResizeObserver + гистерезис).
 */
export function useGalleryCardOverlayTimeFit({
  enabled,
  controlsRef,
  badgeRef,
  timeRef,
  rightRef,
  layoutKey
}: Args): boolean {
  const [hideTime, setHideTime] = useState(false);
  const hideTimeRef = useRef(hideTime);
  hideTimeRef.current = hideTime;
  const timeWidthCacheRef = useRef(0);

  useLayoutEffect(() => {
    if (!enabled) {
      setHideTime(false);
      timeWidthCacheRef.current = 0;
      return;
    }

    const controls = controlsRef.current;
    const badge = badgeRef.current;
    const right = rightRef.current;
    if (!controls || !badge || !right) return;

    const measure = () => {
      const time = timeRef.current;
      if (time) {
        const w = time.offsetWidth;
        if (w > 0) timeWidthCacheRef.current = w;
      }

      const timeWidthPx = time?.offsetWidth || timeWidthCacheRef.current;
      if (timeWidthPx <= 0) {
        // Ещё не измерили — оставить видимым, чтобы снять ширину на следующем кадре.
        if (hideTimeRef.current) setHideTime(false);
        return;
      }

      const left = badge.parentElement;
      const nextHidden = shouldHideOverlayTime({
        availablePx: controls.clientWidth,
        badgeWidthPx: badge.offsetWidth,
        timeWidthPx,
        rightWidthPx: right.offsetWidth,
        leftGapPx: readGapPx(left, 6),
        rowGapPx: readGapPx(controls, 8),
        currentlyHidden: hideTimeRef.current
      });

      if (nextHidden !== hideTimeRef.current) {
        setHideTime(nextHidden);
      }
    };

    measure();
    const raf = requestAnimationFrame(measure);
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(controls);
    window.addEventListener('resize', measure);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [enabled, controlsRef, badgeRef, timeRef, rightRef, layoutKey, hideTime]);

  return hideTime;
}
