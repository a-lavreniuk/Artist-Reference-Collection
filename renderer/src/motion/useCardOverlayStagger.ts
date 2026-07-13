import { useEffect, useRef } from 'react';
import { ensureGsapSetup } from './gsapSetup';
import { arcMotionTokens } from './arcMotionTokens';
import { getPrefersReducedMotion } from './prefersReducedMotion';

/** Card overlay 2.0 (Figma 829:7274): enter stagger — timeline first, then badge/time/actions. */
const CARD_OVERLAY_ENTER_DURATION_S = 0.3;
const CARD_OVERLAY_INITIAL_DELAY_S = 0.15;
const CARD_OVERLAY_STAGGER_S = 0.15;

/** Video timeline first; then badge, time, actions (DOM order within each group). */
const OVERLAY_STAGGER_ORDER = [
  '.arc-gallery-card-overlay-timeline',
  '.arc-gallery-card-overlay-badge',
  '.arc-gallery-card-overlay-time',
  '.arc-gallery-card-overlay-action'
] as const;

function collectOverlayStaggerElements(container: HTMLElement): HTMLElement[] {
  const elements: HTMLElement[] = [];
  for (const selector of OVERLAY_STAGGER_ORDER) {
    elements.push(...container.querySelectorAll<HTMLElement>(selector));
  }
  return elements;
}

export function useCardOverlayStagger(
  active: boolean,
  containerRef: React.RefObject<HTMLElement | null>
): void {
  const wasActive = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const elements = collectOverlayStaggerElements(container);
    if (elements.length === 0) {
      wasActive.current = false;
      return;
    }

    const gsap = ensureGsapSetup();
    const reduced = getPrefersReducedMotion();
    const duration = reduced ? 0 : CARD_OVERLAY_ENTER_DURATION_S;

    if (active && !wasActive.current) {
      if (reduced) {
        gsap.set(elements, { opacity: 1, y: 0 });
      } else {
        gsap.fromTo(
          elements,
          { opacity: 0, y: 4 },
          {
            opacity: 1,
            y: 0,
            duration,
            delay: CARD_OVERLAY_INITIAL_DELAY_S,
            ease: arcMotionTokens.ease,
            stagger: CARD_OVERLAY_STAGGER_S,
            overwrite: 'auto'
          }
        );
      }
    } else if (!active && wasActive.current) {
      gsap.killTweensOf(elements);
      if (!reduced) {
        gsap.to(elements, {
          opacity: 0,
          y: 4,
          duration: duration * 0.6,
          ease: arcMotionTokens.ease,
          overwrite: 'auto'
        });
      } else {
        gsap.set(elements, { opacity: 0, y: 4 });
      }
    }

    wasActive.current = active;
  }, [active, containerRef]);
}
