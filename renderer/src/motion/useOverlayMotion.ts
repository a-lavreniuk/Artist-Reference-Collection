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

type OverlayMotionRest = {
  opacity: number;
  scale: number;
  y: number;
};

function overlayMotionRest(): OverlayMotionRest {
  return { opacity: 1, scale: 1, y: 0 };
}

/** Pure entrance decision — used by hooks and unit tests. */
export function resolveOverlayEntranceAction(
  entranceDone: boolean,
  el: HTMLElement | null,
  animatedEl: HTMLElement | null
): 'entrance' | 'rest' | 'skip' {
  if (!el) return 'skip';
  if (animatedEl !== el) return 'entrance';
  if (!entranceDone) return 'entrance';
  return 'rest';
}

function applyOverlayMotionRest(gsap: ReturnType<typeof ensureGsapSetup>, el: HTMLElement): void {
  gsap.set(el, overlayMotionRest());
}

function runOverlayEntrance(
  el: HTMLElement,
  preset: OverlayMotionPreset,
  durationToken: 'fast' | 'base' | 'slow'
): void {
  const gsap = ensureGsapSetup();
  const reduced = getPrefersReducedMotion();
  const duration = motionDuration(durationToken, reduced);
  const from = overlayMotionFrom(preset);

  if (reduced) {
    applyOverlayMotionRest(gsap, el);
    return;
  }

  gsap.killTweensOf(el);
  gsap.fromTo(
    el,
    from,
    {
      ...overlayMotionRest(),
      duration,
      ease: arcMotionTokens.ease,
      overwrite: true
    }
  );
}

function runOverlayExit(
  el: HTMLElement,
  preset: OverlayMotionPreset,
  durationToken: 'fast' | 'base' | 'slow',
  onComplete: () => void
): void {
  const gsap = ensureGsapSetup();
  const reduced = getPrefersReducedMotion();
  const duration = motionDuration(durationToken, reduced);
  const from = overlayMotionFrom(preset);

  if (reduced) {
    onComplete();
    return;
  }

  gsap.killTweensOf(el);
  gsap.to(el, {
    ...from,
    duration,
    ease: arcMotionTokens.ease,
    overwrite: true,
    onComplete
  });
}

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
  const entranceDoneRef = useRef(false);
  const animatedElRef = useRef<HTMLElement | null>(null);
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
        entranceDoneRef.current = false;
        animatedElRef.current = null;
      }
      return;
    }

    if (open) {
      if (animatedElRef.current !== el) {
        entranceDoneRef.current = false;
        animatedElRef.current = el;
      }

      const action = resolveOverlayEntranceAction(entranceDoneRef.current, el, animatedElRef.current);
      if (action === 'entrance') {
        runOverlayEntrance(el, preset, durationToken);
        entranceDoneRef.current = true;
      } else if (action === 'rest') {
        applyOverlayMotionRest(ensureGsapSetup(), el);
      }
      prevOpenRef.current = true;
      return;
    }

    if (wasOpen === true) {
      entranceDoneRef.current = false;
      animatedElRef.current = null;
      runOverlayExit(el, preset, durationToken, () => {
        if (!openRef.current) {
          setRender(false);
          onExitCompleteRef.current?.();
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
  const panelEntranceDoneRef = useRef(false);
  const backdropEntranceDoneRef = useRef(false);
  const animatedPanelRef = useRef<HTMLElement | null>(null);
  const animatedBackdropRef = useRef<HTMLElement | null>(null);
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
        panelEntranceDoneRef.current = false;
        backdropEntranceDoneRef.current = false;
        animatedPanelRef.current = null;
        animatedBackdropRef.current = null;
      }
      return;
    }

    const runEntrance = () => {
      if (backdrop) {
        if (animatedBackdropRef.current !== backdrop) {
          backdropEntranceDoneRef.current = false;
          animatedBackdropRef.current = backdrop;
        }
        if (!backdropEntranceDoneRef.current) {
          runOverlayEntrance(backdrop, backdropPreset, durationToken);
          backdropEntranceDoneRef.current = true;
        } else {
          applyOverlayMotionRest(ensureGsapSetup(), backdrop);
        }
      }

      if (panel) {
        if (animatedPanelRef.current !== panel) {
          panelEntranceDoneRef.current = false;
          animatedPanelRef.current = panel;
        }
        if (!panelEntranceDoneRef.current) {
          runOverlayEntrance(panel, preset, durationToken);
          panelEntranceDoneRef.current = true;
        } else {
          applyOverlayMotionRest(ensureGsapSetup(), panel);
        }
      }
    };

    const runExit = () => {
      panelEntranceDoneRef.current = false;
      backdropEntranceDoneRef.current = false;
      animatedPanelRef.current = null;
      animatedBackdropRef.current = null;

      let completed = 0;
      const targets = (panel ? 1 : 0) + (backdrop ? 1 : 0);
      const maybeDone = () => {
        completed += 1;
        if (completed >= targets && !openRef.current) {
          setRender(false);
          onExitCompleteRef.current?.();
        }
      };

      if (backdrop) {
        runOverlayExit(backdrop, backdropPreset, durationToken, maybeDone);
      }
      if (panel) {
        runOverlayExit(panel, preset, durationToken, maybeDone);
      }
    };

    if (open) {
      runEntrance();
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
