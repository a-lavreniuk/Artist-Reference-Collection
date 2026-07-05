import { useLayoutEffect, useRef } from 'react';
import type { MasonryItemLayout } from '../components/masonry/masonryTypes';
import { ensureGsapSetup } from './gsapSetup';
import { arcMotionTokens, motionDuration } from './arcMotionTokens';
import { getPrefersReducedMotion } from './prefersReducedMotion';

const revealedIdsGlobal = new Set<string>();

/** Сколько карточек на первом экране идут с поочерёдным stagger. */
const FIRST_SCREEN_STAGGER_CAP = 20;
const MAX_REF_RETRIES = 8;

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
  return el.querySelector<HTMLElement>('.arc-gallery-card-wrap') ?? el;
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
  gsap.set(motionTarget(el), { clearProps: 'opacity,transform' });
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
      resetMountedItems(gsap, itemRefs, animatingRef.current);
      revealedIdsGlobal.clear();
      batchDoneRef.current = false;
      prevResetKeyRef.current = resetKey;
    }

    let retryRaf = 0;

    const run = (retryPass = 0): void => {
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
        if (revealedIdsGlobal.has(id) || animatingRef.current.has(id)) continue;
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
        to: gsap.TweenVars,
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

        gsap.to(targets, {
          ...to,
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
        playEnter(sorted.slice(0, FIRST_SCREEN_STAGGER_CAP), { opacity: 1, y: 0, scale: 1 }, stagger);
        playEnter(sorted.slice(FIRST_SCREEN_STAGGER_CAP), { opacity: 1, y: 0, scale: 1 }, false);
      }

      const pendingInitial = [...currentVisible].filter(
        (id) => !revealedIdsGlobal.has(id) && !animatingRef.current.has(id)
      );
      const pendingWithoutRef = pendingInitial.filter((id) => !itemRefs.current?.has(id));

      if (!batchDoneRef.current) {
        if (pendingWithoutRef.length > 0 && retryPass < MAX_REF_RETRIES) {
          retryRaf = requestAnimationFrame(() => run(retryPass + 1));
          return;
        }
        if (pendingWithoutRef.length > 0 && retryPass >= MAX_REF_RETRIES) {
          forceRevealVisible(gsap, currentVisible, itemRefs, animatingRef.current);
        }
        if (pendingInitial.length === 0 || initialEnter.length > 0) {
          batchDoneRef.current = true;
        }
      }

      playEnter(appendEnter, { opacity: 1, y: 0 }, stagger);
      playEnter(scrollEnter, { opacity: 1, y: 0 }, false);
    };

    run(0);

    return () => {
      if (retryRaf) cancelAnimationFrame(retryRaf);
    };
  }, [enabled, resetKey, visibleKey, appendKey, itemRefs]);
}
