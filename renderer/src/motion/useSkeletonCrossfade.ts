import { useEffect, useRef } from 'react';
import { ensureGsapSetup } from './gsapSetup';
import { arcMotionTokens, motionDuration } from './arcMotionTokens';
import { getPrefersReducedMotion } from './prefersReducedMotion';

export function useSkeletonCrossfade(
  loaded: boolean,
  skeletonRef: React.RefObject<HTMLElement | null>,
  imageRef: React.RefObject<HTMLElement | null>,
  onComplete?: () => void,
  resetKey?: string
): void {
  const crossfadeToken = useRef(0);

  useEffect(() => {
    crossfadeToken.current += 1;
  }, [resetKey]);

  useEffect(() => {
    if (!loaded) return;
    const skeleton = skeletonRef.current;
    const image = imageRef.current;
    if (!image) return;

    const gsap = ensureGsapSetup();
    const reduced = getPrefersReducedMotion();
    const duration = motionDuration('base', reduced);
    const token = crossfadeToken.current;

    gsap.killTweensOf([skeleton, image].filter(Boolean));

    if (reduced || !skeleton) {
      gsap.set(image, { opacity: 1, clearProps: 'opacity' });
      onComplete?.();
      return;
    }

    gsap.fromTo(
      image,
      { opacity: 0 },
      {
        opacity: 1,
        duration,
        ease: arcMotionTokens.ease,
        delay: duration * 0.08,
        onComplete: () => {
          if (token !== crossfadeToken.current) return;
          gsap.set(image, { opacity: 1, clearProps: 'opacity' });
          onComplete?.();
        }
      }
    );
    gsap.to(skeleton, {
      opacity: 0,
      duration,
      ease: arcMotionTokens.ease,
      onComplete: () => {
        if (token !== crossfadeToken.current) return;
        gsap.set(skeleton, { clearProps: 'opacity' });
      }
    });
  }, [loaded, skeletonRef, imageRef, onComplete, resetKey]);
}
