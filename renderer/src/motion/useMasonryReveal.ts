import { useLayoutEffect, useRef } from 'react';
import type { MasonryItemLayout } from '../components/masonry/masonryTypes';
import { ensureGsapSetup } from './gsapSetup';
import { arcMotionTokens, motionDuration } from './arcMotionTokens';
import { getPrefersReducedMotion } from './prefersReducedMotion';

const revealedIdsGlobal = new Set<string>();

/** Сколько карточек на первом экране идут с поочерёдным stagger. */
const FIRST_SCREEN_STAGGER_CAP = 20;
const MAX_REF_RETRIES = 8;
const REVEAL_FROM = { opacity: 0, y: 10, scale: 0.98 };
const REVEAL_TO = { opacity: 1, y: 0, scale: 1 };

export function resetMasonryRevealCache(): void {
  revealedIdsGlobal.clear();
}

export function isMasonryItemRevealed(id: string): boolean {
  return revealedIdsGlobal.has(id);
}

type RevealOptions = {
  visibleIds: Set<string>;
  itemRefs: React.RefObject<Map<string, HTMLElement>>;
  layouts: Map<string, MasonryItemLayout>;
  appendIds?: Set<string>;
  resetKey?: string;
  enabled?: boolean;
};

function setMembershipKey(set: Set<string> | undefined): string {
  if (!set || set.size === 0) return '';
  return [...set].sort().join('\0');
}

function motionTarget(el: HTMLElement): HTMLElement {
  return el;
}

function itemId(el: HTMLElement): string | null {
  return el.dataset.masonryItemId ?? null;
}

function sortByLayout(
  elements: HTMLElement[],
  layouts: Map<string, MasonryItemLayout>
): HTMLElement[] {
  return [...elements].sort((a, b) => {
    const la = layouts.get(itemId(a) ?? '');
    const lb = layouts.get(itemId(b) ?? '');
    if (!la || !lb) return 0;
    if (Math.abs(la.y - lb.y) > 1) return la.y - lb.y;
    return la.x - lb.x;
  });
}

function markRevealed(
  gsap: ReturnType<typeof ensureGsapSetup>,
  el: HTMLElement,
  animating: Set<string>
): void {
  const id = itemId(el);
  el.setAttribute('data-revealed', 'true');
  gsap.set(motionTarget(el), { clearProps: 'transform,opacity' });
  if (id) {
    revealedIdsGlobal.add(id);
    animating.delete(id);
  }
}

function resetMountedItems(
  gsap: ReturnType<typeof ensureGsapSetup>,
  itemRefs: React.RefObject<Map<string, HTMLElement>>,
  animating: Set<string>
): void {
  for (const el of itemRefs.current?.values() ?? []) {
    el.removeAttribute('data-revealed');
    gsap.killTweensOf(motionTarget(el));
  }
  animating.clear();
}

function clearStaleAnimating(
  gsap: ReturnType<typeof ensureGsapSetup>,
  itemRefs: React.RefObject<Map<string, HTMLElement>>,
  animating: Set<string>
): void {
  for (const id of [...animating]) {
    const el = itemRefs.current?.get(id);
    if (!el || !gsap.isTweening(motionTarget(el))) {
      animating.delete(id);
    }
  }
}

/** batchDone только когда все видимые id либо раскрыты, либо в активной анимации. */
export function shouldCloseInitialRevealBatch(
  visibleCount: number,
  pendingInitialCount: number,
  batchDone: boolean
): boolean {
  if (batchDone || visibleCount === 0) return false;
  return pendingInitialCount === 0;
}

function revealFallbackDelayMs(): number {
  return 150;
}


function forceRevealVisible(
  gsap: ReturnType<typeof ensureGsapSetup>,
  visible: Set<string>,
  itemRefs: React.RefObject<Map<string, HTMLElement>>,
  animating: Set<string>
): void {
  for (const id of visible) {
    if (revealedIdsGlobal.has(id)) continue;
    const el = itemRefs.current?.get(id);
    if (el) markRevealed(gsap, el, animating);
  }
}

export function useMasonryReveal({
  visibleIds,
  itemRefs,
  layouts,
  appendIds,
  resetKey,
  enabled = true
}: RevealOptions): void {
  const prevResetKeyRef = useRef<string | undefined>(undefined);
  const animatingRef = useRef(new Set<string>());
  const batchDoneRef = useRef(false);
  const fallbackTimerRef = useRef(0);
  const layoutsRef = useRef(layouts);
  const visibleRef = useRef(visibleIds);
  const appendRef = useRef(appendIds);

  layoutsRef.current = layouts;
  visibleRef.current = visibleIds;
  appendRef.current = appendIds;

  const visibleKey = setMembershipKey(visibleIds);
  const appendKey = setMembershipKey(appendIds);

  useLayoutEffect(() => {
    if (!enabled) return;

    const gsap = ensureGsapSetup();

    if (resetKey !== undefined && resetKey !== prevResetKeyRef.current) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = 0;
      resetMountedItems(gsap, itemRefs, animatingRef.current);
      revealedIdsGlobal.clear();
      batchDoneRef.current = false;
      prevResetKeyRef.current = resetKey;
    }

    const armRevealFallback = (): void => {
      window.clearTimeout(fallbackTimerRef.current);
      const hasStuckHidden = [...visibleRef.current].some((id) => {
        if (revealedIdsGlobal.has(id) || animatingRef.current.has(id)) return false;
        return Boolean(itemRefs.current?.get(id));
      });
      if (!hasStuckHidden || getPrefersReducedMotion()) return;
      fallbackTimerRef.current = window.setTimeout(() => {
        forceRevealVisible(gsap, visibleRef.current, itemRefs, animatingRef.current);
        fallbackTimerRef.current = 0;
      }, revealFallbackDelayMs());
    };

    let retryRaf = 0;

    const run = (retryPass = 0): void => {
      clearStaleAnimating(gsap, itemRefs, animatingRef.current);

      const reduced = getPrefersReducedMotion();
      const duration = motionDuration('fast', reduced);
      const stagger = reduced ? 0 : arcMotionTokens.stagger;
      const currentLayouts = layoutsRef.current;
      const currentVisible = visibleRef.current;
      const currentAppend = appendRef.current;

      const initialEnter: HTMLElement[] = [];
      const appendEnter: HTMLElement[] = [];
      const scrollEnter: HTMLElement[] = [];

      for (const id of currentVisible) {
        if (revealedIdsGlobal.has(id)) continue;
        if (animatingRef.current.has(id)) {
          const stuckEl = itemRefs.current?.get(id);
          if (stuckEl && !gsap.isTweening(motionTarget(stuckEl))) {
            animatingRef.current.delete(id);
          } else {
            continue;
          }
        }
        const el = itemRefs.current?.get(id);
        if (!el) continue;

        if (currentAppend?.has(id)) {
          appendEnter.push(el);
        } else if (!batchDoneRef.current) {
          initialEnter.push(el);
        } else {
          scrollEnter.push(el);
        }
      }

      const playEnter = (
        elements: HTMLElement[],
        staggerEach: number | false
      ) => {
        if (elements.length === 0) return;

        const sorted = sortByLayout(elements, currentLayouts);
        const targets = sorted.map(motionTarget);

        sorted.forEach((el) => {
          const id = itemId(el);
          if (id) animatingRef.current.add(id);
        });

        if (reduced) {
          sorted.forEach((el) => markRevealed(gsap, el, animatingRef.current));
          return;
        }

        gsap.set(targets, REVEAL_FROM);
        gsap.fromTo(targets, REVEAL_FROM, {
          ...REVEAL_TO,
          duration,
          ease: arcMotionTokens.ease,
          stagger: staggerEach === false ? 0 : staggerEach,
          overwrite: 'auto',
          onComplete: () => {
            sorted.forEach((el) => markRevealed(gsap, el, animatingRef.current));
          },
          onInterrupt: () => {
            sorted.forEach((el) => markRevealed(gsap, el, animatingRef.current));
          }
        });
      };

      if (initialEnter.length > 0) {
        const sorted = sortByLayout(initialEnter, currentLayouts);
        playEnter(sorted.slice(0, FIRST_SCREEN_STAGGER_CAP), stagger);
        playEnter(sorted.slice(FIRST_SCREEN_STAGGER_CAP), false);
      }

      const pendingInitial = [...currentVisible].filter(
        (id) => !revealedIdsGlobal.has(id) && !animatingRef.current.has(id)
      );
      const pendingWithoutRef = pendingInitial.filter((id) => !itemRefs.current?.has(id));

      if (pendingWithoutRef.length > 0 && retryPass < MAX_REF_RETRIES) {
        retryRaf = requestAnimationFrame(() => run(retryPass + 1));
        return;
      }

      if (pendingWithoutRef.length > 0 && retryPass >= MAX_REF_RETRIES) {
        forceRevealVisible(gsap, currentVisible, itemRefs, animatingRef.current);
      }

      if (shouldCloseInitialRevealBatch(currentVisible.size, pendingInitial.length, batchDoneRef.current)) {
        batchDoneRef.current = true;
      }

      playEnter(appendEnter, stagger);
      playEnter(scrollEnter, false);

      armRevealFallback();
    };

    run(0);

    return () => {
      if (retryRaf) cancelAnimationFrame(retryRaf);
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = 0;
    };
  }, [enabled, resetKey, visibleKey, appendKey, itemRefs]);
}
