import { arcMotionTokens, motionDuration } from './arcMotionTokens';

import { ensureGsapSetup } from './gsapSetup';

import { getPrefersReducedMotion } from './prefersReducedMotion';

import { overlayMotionFrom } from './overlayMotionPresets';



/** Prefer the modal card — scaling the full-screen host is almost invisible. */
export function resolveModalMotionTarget(host: HTMLElement): HTMLElement {
  return host.querySelector<HTMLElement>('.arc-modal') ?? host;
}

/** Enter tween for the modal card (fade + scale 0.98). */
export function playModalHostEnter(target: HTMLElement): void {
  const gsap = ensureGsapSetup();
  const reduced = getPrefersReducedMotion();
  const duration = motionDuration('base', reduced);
  const from = overlayMotionFrom('fade-scale');

  gsap.killTweensOf(target);
  if (reduced) {
    gsap.set(target, { opacity: 1, scale: 1 });
    return;
  }

  gsap.set(target, from);
  gsap.to(target, {
    opacity: 1,
    scale: 1,
    duration,
    ease: arcMotionTokens.ease,
    overwrite: true
  });
}

/**
 * Floating panels start with `visibility: hidden` until geometry is ready.
 * Hold the enter-from pose, then play when the card is visible.
 */
export function playModalHostEnterWhenVisible(host: HTMLElement): () => void {
  const gsap = ensureGsapSetup();
  const from = overlayMotionFrom('fade-scale');
  let played = false;

  const tryPlay = (): boolean => {
    if (played) return true;
    const target = resolveModalMotionTarget(host);
    if (target.style.visibility === 'hidden') {
      gsap.set(target, from);
      return false;
    }
    played = true;
    playModalHostEnter(target);
    return true;
  };

  if (tryPlay()) return () => undefined;

  const observer = new MutationObserver(() => {
    if (tryPlay()) observer.disconnect();
  });
  observer.observe(host, {
    attributes: true,
    subtree: true,
    childList: true,
    attributeFilter: ['style']
  });

  return () => observer.disconnect();
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

const MENU_ITEMS_ENTER_SPEED = 2;

/** Context menu rows/items — stagger fade-in on open. */
export function playMenuItemsEnter(panel: HTMLElement): void {
  const gsap = ensureGsapSetup();
  const reduced = getPrefersReducedMotion();
  const duration = motionDuration('fast', reduced) / MENU_ITEMS_ENTER_SPEED;
  const nodes = panel.querySelectorAll<HTMLElement>(
    '.context-menu__item, .context-menu__separator, .context-menu__header, .context-menu__filter-row'
  );

  gsap.killTweensOf(nodes);
  if (reduced) {
    gsap.set(nodes, { opacity: 1 });
    return;
  }

  gsap.set(nodes, { opacity: 0 });
  gsap.fromTo(
    nodes,
    { opacity: 0 },
    {
      opacity: 1,
      duration,
      stagger: arcMotionTokens.stagger / MENU_ITEMS_ENTER_SPEED,
      ease: arcMotionTokens.ease,
      overwrite: true
    }
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



  gsap.set(alert, { opacity: 0, y: 8 });

  gsap.to(alert, { opacity: 1, y: 0, duration, ease: arcMotionTokens.ease, overwrite: true });

}


