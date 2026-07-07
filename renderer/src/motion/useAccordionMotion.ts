import { useEffect, useRef } from 'react';
import { ensureGsapSetup } from './gsapSetup';
import { arcMotionTokens, motionDuration } from './arcMotionTokens';
import { getPrefersReducedMotion } from './prefersReducedMotion';

export function useAccordionMotion(
  open: boolean,
  bodyRef: React.RefObject<HTMLElement | null>
): void {
  const prevOpen = useRef(open);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    const gsap = ensureGsapSetup();
    const reduced = getPrefersReducedMotion();
    const duration = motionDuration('base', reduced);

    gsap.killTweensOf(body);

    if (reduced) {
      gsap.set(body, { height: open ? 'auto' : 0, opacity: open ? 1 : 0, overflow: 'hidden' });
      prevOpen.current = open;
      return;
    }

    if (open) {
      gsap.set(body, { height: 'auto', overflow: 'hidden' });
      const fullHeight = body.scrollHeight;
      gsap.fromTo(
        body,
        { height: 0, opacity: 0 },
        {
          height: fullHeight,
          opacity: 1,
          duration,
          ease: arcMotionTokens.ease,
          onComplete: () => {
            gsap.set(body, { height: 'auto' });
          }
        }
      );
    } else if (prevOpen.current) {
      const fullHeight = body.scrollHeight;
      gsap.fromTo(
        body,
        { height: fullHeight, opacity: 1 },
        {
          height: 0,
          opacity: 0,
          duration,
          ease: arcMotionTokens.ease,
          overflow: 'hidden'
        }
      );
    }

    prevOpen.current = open;
  }, [open, bodyRef]);
}
