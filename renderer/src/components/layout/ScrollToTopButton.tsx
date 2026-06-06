import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';

const SCROLL_VIEWPORT_MULTIPLIER = 2;

type Props = {
  enabled?: boolean;
};

function getScrollRoot(): HTMLElement | null {
  return document.querySelector('.arc-app-outlet');
}

function isReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function ScrollToTopButton({ enabled = true }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);

  const updateVisibility = useCallback((root: HTMLElement) => {
    const threshold = root.clientHeight * SCROLL_VIEWPORT_MULTIPLIER;
    setVisible(root.scrollTop >= threshold);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setVisible(false);
      return undefined;
    }

    const root = getScrollRoot();
    if (!root) return undefined;

    const onScroll = () => updateVisibility(root);
    updateVisibility(root);
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, [enabled, updateVisibility]);

  useLayoutEffect(() => {
    if (buttonRef.current) {
      void hydrateArcNavbarIcons(buttonRef.current);
    }
  }, [visible]);

  const scrollToTop = () => {
    const root = getScrollRoot();
    if (!root) return;
    root.scrollTo({ top: 0, behavior: isReducedMotion() ? 'auto' : 'smooth' });
  };

  if (!enabled) return null;

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`arc-scroll-to-top arc-ui-kit-scope btn btn-primary btn-ds btn-m${visible ? ' is-visible' : ''}`}
      data-btn-size="m"
      aria-label="Вернуться наверх"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      onClick={scrollToTop}
    >
      <span className="btn-ds__icon arc-icon-arrow-up" aria-hidden="true" />
      <span className="btn-ds__value">Вернуться наверх</span>
    </button>
  );
}
