import { useEffect, useRef } from 'react';
import { ensureGsapSetup } from './gsapSetup';
import { arcMotionTokens, motionDuration } from './arcMotionTokens';
import { getPrefersReducedMotion } from './prefersReducedMotion';

export function useCardOverlayStagger(
  active: boolean,
  containerRef: React.RefObject<HTMLElement | null>
): void {
  const wasActive = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const buttons = container.querySelectorAll<HTMLElement>(
      '.arc-gallery-overlay-btn, .arc-gallery-overlay-bookmark'
    );
    if (buttons.length === 0) return;

    const gsap = ensureGsapSetup();
    const reduced = getPrefersReducedMotion();
    const duration = motionDuration('fast', reduced);

    if (active && !wasActive.current) {
      if (reduced) {
        gsap.set(buttons, { opacity: 1, y: 0 });
      } else {
        gsap.fromTo(
          buttons,
          { opacity: 0, y: 4 },
          {
            opacity: 1,
            y: 0,
            duration,
            ease: arcMotionTokens.ease,
            stagger: arcMotionTokens.stagger,
            overwrite: 'auto'
          }
        );
      }
    } else if (!active && wasActive.current) {
      gsap.killTweensOf(buttons);
      if (!reduced) {
        gsap.to(buttons, {
          opacity: 0,
          duration: duration * 0.6,
          ease: arcMotionTokens.ease,
          overwrite: 'auto'
        });
      }
    }

    wasActive.current = active;
  }, [active, containerRef]);
}
