import { createPortal } from 'react-dom';
import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useOverlayMotionPair } from '../../../motion';
import type { NavbarSearchMode } from '../../../search/navbarSearchMode';

export type NavbarSearchPanelLayout = {
  top: number;
  left: number;
  width: number;
};

type NavbarSearchPanelPortalProps = {
  open: boolean;
  layout: NavbarSearchPanelLayout | null;
  searchMode: NavbarSearchMode;
  onClose: () => void;
  children: ReactNode;
};

/** Backdrop и dropdown панели — в portal, чтобы не ломались из-за transform/stacking у островков. */
export default function NavbarSearchPanelPortal({
  open,
  layout,
  searchMode,
  onClose,
  children
}: NavbarSearchPanelPortalProps) {
  const layoutHoldRef = useRef(layout);
  if (layout) layoutHoldRef.current = layout;

  const { panelRef, backdropRef, render } = useOverlayMotionPair(open, {
    preset: 'fade-slide-down',
    backdropPreset: 'fade'
  });

  useLayoutEffect(() => {
    if (!render) return undefined;
    document.body.classList.add('arc-search-panel-open');
    if (searchMode === 'similar') {
      document.body.classList.add('arc-similar-search-panel-open');
    } else {
      document.body.classList.remove('arc-similar-search-panel-open');
    }
    return () => {
      document.body.classList.remove('arc-search-panel-open');
      document.body.classList.remove('arc-similar-search-panel-open');
    };
  }, [render, searchMode]);

  const activeLayout = layout ?? layoutHoldRef.current;
  if (!render || !activeLayout) return null;

  return createPortal(
    <>
      <button
        ref={backdropRef as React.RefObject<HTMLButtonElement>}
        type="button"
        className="arc-search-backdrop"
        aria-label="Закрыть поиск"
        onClick={onClose}
      />
      <div
        ref={panelRef as React.RefObject<HTMLDivElement>}
        className="arc-search-panel arc-ui-kit-scope"
        data-elevation="raised"
        data-typo-tone="white"
        style={{
          top: activeLayout.top,
          left: activeLayout.left,
          width: activeLayout.width
        }}
      >
        {children}
      </div>
    </>,
    document.body
  );
}
