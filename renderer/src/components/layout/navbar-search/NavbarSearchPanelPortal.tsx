import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

export type NavbarSearchPanelLayout = {
  top: number;
  left: number;
  width: number;
};

type NavbarSearchPanelPortalProps = {
  open: boolean;
  layout: NavbarSearchPanelLayout | null;
  onClose: () => void;
  children: ReactNode;
};

/** Backdrop и dropdown панели — в portal, чтобы не ломались из-за transform/stacking у островков. */
export default function NavbarSearchPanelPortal({
  open,
  layout,
  onClose,
  children
}: NavbarSearchPanelPortalProps) {
  if (!open || !layout) return null;

  return createPortal(
    <>
      <button type="button" className="arc-search-backdrop" aria-label="Закрыть поиск" onClick={onClose} />
      <div
        className="arc-search-panel arc-ui-kit-scope"
        data-elevation="raised"
        data-typo-tone="white"
        style={{
          top: layout.top,
          left: layout.left,
          width: layout.width
        }}
      >
        {children}
      </div>
    </>,
    document.body
  );
}
