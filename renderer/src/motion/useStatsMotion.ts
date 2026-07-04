import { useEffect } from 'react';
import { ensureGsapSetup } from './gsapSetup';
import { arcMotionTokens, motionDuration } from './arcMotionTokens';
import { getPrefersReducedMotion } from './prefersReducedMotion';

export function useCountUp(
  ref: React.RefObject<HTMLElement | null>,
  target: number,
  enabled: boolean
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const gsap = ensureGsapSetup();
    const reduced = getPrefersReducedMotion();
    const duration = motionDuration('base', reduced);
    const state = { val: 0 };

    gsap.killTweensOf(state);

    if (reduced) {
      el.textContent = String(target);
      return;
    }

    gsap.to(state, {
      val: target,
      duration,
      ease: arcMotionTokens.ease,
      snap: { val: 1 },
      onUpdate: () => {
        el.textContent = String(Math.round(state.val));
      }
    });
  }, [ref, target, enabled]);
}

export function useDiskBarMotion(
  segmentRefs: React.RefObject<(HTMLElement | null)[]>,
  flexValues: number[],
  enabled: boolean
): void {
  useEffect(() => {
    if (!enabled) return;
    const refs = segmentRefs.current;
    if (!refs || refs.length === 0) return;

    const gsap = ensureGsapSetup();
    const reduced = getPrefersReducedMotion();
    const duration = motionDuration('base', reduced);

    refs.forEach((el, i) => {
      if (!el) return;
      const target = flexValues[i] ?? 0;
      gsap.killTweensOf(el);
      if (reduced) {
        gsap.set(el, { flexGrow: target, opacity: 1 });
        return;
      }
      gsap.fromTo(
        el,
        { flexGrow: 0, opacity: 0.85 },
        { flexGrow: target, opacity: 1, duration, ease: arcMotionTokens.ease, delay: i * 0.06 }
      );
    });
  }, [segmentRefs, flexValues, enabled]);
}
