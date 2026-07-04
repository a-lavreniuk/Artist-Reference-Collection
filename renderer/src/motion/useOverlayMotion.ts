import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ensureGsapSetup } from './gsapSetup';
import { arcMotionTokens, motionDuration, type OverlayMotionPreset } from './arcMotionTokens';
import { getPrefersReducedMotion } from './prefersReducedMotion';
import { overlayMotionFrom } from './overlayMotionPresets';

type Options = {
  open: boolean;
  preset?: OverlayMotionPreset;
  durationToken?: 'fast' | 'base' | 'slow';
  onExitComplete?: () => void;
};

export function useOverlayMotion<T extends HTMLElement>(
  open: boolean,
  options: Omit<Options, 'open'> = {}
): React.RefObject<T | null> {
  const {
    preset = 'fade-scale',
    durationToken = 'base',
    onExitComplete
  } = options;
  const ref = useRef<T | null>(null);
  const [render, setRender] = useState(open);
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useLayoutEffect(() => {
    if (open) setRender(true);
  }, [open]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!render || !el) return;

    const gsap = ensureGsapSetup();
    const reduced = getPrefersReducedMotion();
    const duration = motionDuration(durationToken, reduced);
    const from = overlayMotionFrom(preset);

    gsap.killTweensOf(el);

    if (open) {
      gsap.fromTo(
        el,
        from,
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration,
          ease: arcMotionTokens.ease,
          overwrite: true
        }
      );
      return;
    }

    gsap.to(el, {
      ...from,
      duration,
      ease: arcMotionTokens.ease,
      overwrite: true,
      onComplete: () => {
        if (!openRef.current) {
          setRender(false);
          onExitComplete?.();
        }
      }
    });
  }, [open, render, preset, durationToken, onExitComplete]);

  return ref;
}

export function useOverlayMotionPair(
  open: boolean,
  options: Omit<Options, 'open'> & { backdropPreset?: OverlayMotionPreset } = {}
) {
  const {
    preset = 'fade-scale',
    backdropPreset = 'fade-scale',
    durationToken = 'base',
    onExitComplete
  } = options;
  const panelRef = useRef<HTMLElement | null>(null);
  const backdropRef = useRef<HTMLElement | null>(null);
  const [render, setRender] = useState(open);
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useLayoutEffect(() => {
    if (open) setRender(true);
  }, [open]);

  useLayoutEffect(() => {
    if (!render) return;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (!panel && !backdrop) return;

    const gsap = ensureGsapSetup();
    const reduced = getPrefersReducedMotion();
    const duration = motionDuration(durationToken, reduced);
    const panelFrom = overlayMotionFrom(preset);
    const backdropFrom = overlayMotionFrom(backdropPreset);

    if (panel) gsap.killTweensOf(panel);
    if (backdrop) gsap.killTweensOf(backdrop);

    if (open) {
      if (backdrop) {
        gsap.fromTo(backdrop, backdropFrom, {
          opacity: 1,
          duration,
          ease: arcMotionTokens.ease
        });
      }
      if (panel) {
        gsap.fromTo(panel, panelFrom, {
          opacity: 1,
          scale: 1,
          y: 0,
          duration,
          ease: arcMotionTokens.ease
        });
      }
      return;
    }

    let completed = 0;
    const maybeDone = () => {
      completed += 1;
      const targets = (panel ? 1 : 0) + (backdrop ? 1 : 0);
      if (completed >= targets && !openRef.current) {
        setRender(false);
        onExitComplete?.();
      }
    };

    if (backdrop) {
      gsap.to(backdrop, {
        ...backdropFrom,
        duration,
        ease: arcMotionTokens.ease,
        onComplete: maybeDone
      });
    }
    if (panel) {
      gsap.to(panel, {
        ...panelFrom,
        duration,
        ease: arcMotionTokens.ease,
        onComplete: maybeDone
      });
    }
  }, [open, render, preset, backdropPreset, durationToken, onExitComplete]);

  return { panelRef, backdropRef, render };
}
