import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';

export type NavbarMenuRow =
  | {
      type: 'item';
      key: string;
      label: string;
      iconClass?: string;
      disabled?: boolean;
      onSelect?: () => void;
    }
  | { type: 'separator'; key: string }
  | { type: 'label'; key: string; label: string };

type Props = {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  rows: NavbarMenuRow[];
  ariaLabel: string;
};

export default function NavbarPopoverMenu({ open, anchorRef, onClose, rows, ariaLabel }: Props) {
  const menuId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setLayout(null);
      return;
    }
    const rect = anchorRef.current.getBoundingClientRect();
    setLayout({
      top: rect.bottom + 8,
      left: rect.right - 250,
      width: 250
    });
  }, [open, anchorRef]);

  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    void hydrateArcNavbarIcons(panelRef.current);
  }, [open, rows, layout]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !layout) return null;

  return createPortal(
    <>
      <button type="button" className="arc-navbar-menu-backdrop arc-navbar-no-drag" aria-label="Закрыть меню" onClick={onClose} />
      <div
        ref={panelRef}
        id={menuId}
        role="menu"
        aria-label={ariaLabel}
        className="arc-navbar-menu panel elevation-raised arc-ui-kit-scope arc-navbar-no-drag"
        data-elevation="raised"
        data-typo-tone="white"
        style={{ top: layout.top, left: layout.left, width: layout.width }}
      >
        <div className="arc-navbar-menu__list">
          {rows.map((row) => {
            if (row.type === 'separator') {
              return <div key={row.key} className="arc-navbar-menu__sep" role="separator" />;
            }
            if (row.type === 'label') {
              return (
                <p key={row.key} className="arc-navbar-menu__label text-m">
                  {row.label}
                </p>
              );
            }
            return (
              <button
                key={row.key}
                type="button"
                role="menuitem"
                className={`arc-navbar-menu__row${row.disabled ? ' is-disabled' : ''}`}
                disabled={row.disabled}
                onClick={() => {
                  if (row.disabled) return;
                  row.onSelect?.();
                  onClose();
                }}
              >
                <span className="arc-navbar-menu__row-value">{row.label}</span>
                {row.iconClass ? <span className={`arc-navbar-menu__row-icon tab-icon ${row.iconClass}`} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </>,
    document.body
  );
}
