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
  const prevOpenRef = useRef<boolean | null>(null);
  const onExitCompleteRef = useRef(onExitComplete);
  onExitCompleteRef.current = onExitComplete;

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useLayoutEffect(() => {
    if (open) setRender(true);
  }, [open]);

  useLayoutEffect(() => {
    const el = ref.current;
    const wasOpen = prevOpenRef.current;

    if (!render) return;

    if (!el) {
      if (!open && wasOpen !== true) {
        setRender(false);
        onExitCompleteRef.current?.();
        prevOpenRef.current = false;
      }
      return;
    }

    if (open) {
      if (wasOpen !== true) {
        const gsap = ensureGsapSetup();
        const reduced = getPrefersReducedMotion();
        const duration = motionDuration(durationToken, reduced);
        const from = overlayMotionFrom(preset);

        gsap.killTweensOf(el);
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
      }
      prevOpenRef.current = true;
      return;
    }

    if (wasOpen === true) {
      const gsap = ensureGsapSetup();
      const reduced = getPrefersReducedMotion();
      const duration = motionDuration(durationToken, reduced);
      const from = overlayMotionFrom(preset);

      gsap.killTweensOf(el);
      gsap.to(el, {
        ...from,
        duration,
        ease: arcMotionTokens.ease,
        overwrite: true,
        onComplete: () => {
          if (!openRef.current) {
            setRender(false);
            onExitCompleteRef.current?.();
          }
        }
      });
    } else {
      setRender(false);
      onExitCompleteRef.current?.();
    }

    prevOpenRef.current = false;
  }, [open, render, preset, durationToken]);

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
  const prevOpenRef = useRef<boolean | null>(null);
  const onExitCompleteRef = useRef(onExitComplete);
  onExitCompleteRef.current = onExitComplete;

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
    const wasOpen = prevOpenRef.current;

    if (!panel && !backdrop) {
      if (!open && wasOpen !== true) {
        setRender(false);
        onExitCompleteRef.current?.();
        prevOpenRef.current = false;
      }
      return;
    }

    const runEntrance = () => {
      const gsap = ensureGsapSetup();
      const reduced = getPrefersReducedMotion();
      const duration = motionDuration(durationToken, reduced);
      const panelFrom = overlayMotionFrom(preset);
      const backdropFrom = overlayMotionFrom(backdropPreset);

      if (backdrop) {
        gsap.killTweensOf(backdrop);
        gsap.fromTo(backdrop, backdropFrom, {
          opacity: 1,
          duration,
          ease: arcMotionTokens.ease
        });
      }
      if (panel) {
        gsap.killTweensOf(panel);
        gsap.fromTo(panel, panelFrom, {
          opacity: 1,
          scale: 1,
          y: 0,
          duration,
          ease: arcMotionTokens.ease
        });
      }
    };

    const runExit = () => {
      const gsap = ensureGsapSetup();
      const reduced = getPrefersReducedMotion();
      const duration = motionDuration(durationToken, reduced);
      const panelFrom = overlayMotionFrom(preset);
      const backdropFrom = overlayMotionFrom(backdropPreset);

      let completed = 0;
      const maybeDone = () => {
        completed += 1;
        const targets = (panel ? 1 : 0) + (backdrop ? 1 : 0);
        if (completed >= targets && !openRef.current) {
          setRender(false);
          onExitCompleteRef.current?.();
        }
      };

      if (backdrop) {
        gsap.killTweensOf(backdrop);
        gsap.to(backdrop, {
          ...backdropFrom,
          duration,
          ease: arcMotionTokens.ease,
          onComplete: maybeDone
        });
      }
      if (panel) {
        gsap.killTweensOf(panel);
        gsap.to(panel, {
          ...panelFrom,
          duration,
          ease: arcMotionTokens.ease,
          onComplete: maybeDone
        });
      }
    };

    if (open) {
      if (wasOpen !== true) runEntrance();
      prevOpenRef.current = true;
      return;
    }

    if (wasOpen === true) runExit();
    else {
      setRender(false);
      onExitCompleteRef.current?.();
    }
    prevOpenRef.current = false;
  }, [open, render, preset, backdropPreset, durationToken]);

  return { panelRef, backdropRef, render };
}
