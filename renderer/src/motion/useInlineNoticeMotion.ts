import { useEffect, useRef } from 'react';
import { ensureGsapSetup } from './gsapSetup';
import { arcMotionTokens, motionDuration } from './arcMotionTokens';
import { getPrefersReducedMotion } from './prefersReducedMotion';

export function useInlineNoticeMotion(ref: React.RefObject<HTMLElement | null>): void {
  const played = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || played.current) return;
    played.current = true;

    const gsap = ensureGsapSetup();
    const reduced = getPrefersReducedMotion();
    const duration = motionDuration('base', reduced);

    if (reduced) {
      gsap.set(el, { opacity: 1, y: 0 });
      return;
    }

    gsap.fromTo(
      el,
      { opacity: 0, y: -10 },
      { opacity: 1, y: 0, duration, ease: arcMotionTokens.ease }
    );
  }, [ref]);
}
