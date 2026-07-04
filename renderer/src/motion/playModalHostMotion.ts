import { arcMotionTokens, motionDuration } from './arcMotionTokens';

import { ensureGsapSetup } from './gsapSetup';

import { getPrefersReducedMotion } from './prefersReducedMotion';

import { overlayMotionFrom } from './overlayMotionPresets';



/** Enter tween for `.arc-modal-host` (React + UI-Kit). */

export function playModalHostEnter(host: HTMLElement): void {

  const gsap = ensureGsapSetup();

  const reduced = getPrefersReducedMotion();

  const duration = motionDuration('base', reduced);

  const from = overlayMotionFrom('fade-scale');



  gsap.killTweensOf(host);

  if (reduced) {

    gsap.set(host, { opacity: 1, scale: 1 });

    return;

  }



  gsap.fromTo(

    host,

    from,

    { opacity: 1, scale: 1, duration, ease: arcMotionTokens.ease, overwrite: true }

  );

}



/** Exit tween; calls `onComplete` after fade (or immediately if reduced motion). */

export function playModalHostExit(host: HTMLElement, onComplete: () => void): void {

  const gsap = ensureGsapSetup();

  const reduced = getPrefersReducedMotion();

  const duration = motionDuration('base', reduced);

  const from = overlayMotionFrom('fade-scale');



  gsap.killTweensOf(host);

  if (reduced) {

    onComplete();

    return;

  }



  gsap.to(host, {

    ...from,

    duration,

    ease: arcMotionTokens.ease,

    overwrite: true,

    onComplete

  });

}



/** Context menu / dropdown panel — only on open. */

export function playMenuPanelEnter(panel: HTMLElement): void {

  const gsap = ensureGsapSetup();

  const reduced = getPrefersReducedMotion();

  const duration = motionDuration('fast', reduced);



  gsap.killTweensOf(panel);

  if (reduced) {

    gsap.set(panel, { opacity: 1, y: 0 });

    return;

  }



  gsap.fromTo(

    panel,

    { opacity: 0, y: -6 },

    { opacity: 1, y: 0, duration, ease: arcMotionTokens.ease, overwrite: true }

  );

}



/** Toast alert — снизу вверх через прозрачность. */

export function playToastEnter(alert: HTMLElement): void {

  const gsap = ensureGsapSetup();

  const reduced = getPrefersReducedMotion();

  const duration = motionDuration('base', reduced);



  gsap.killTweensOf(alert);

  if (reduced) {

    gsap.set(alert, { opacity: 1, y: 0 });

    return;

  }



  gsap.fromTo(

    alert,

    { opacity: 0, y: 8 },

    { opacity: 1, y: 0, duration, ease: arcMotionTokens.ease, overwrite: true }

  );

}


