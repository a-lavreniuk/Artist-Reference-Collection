import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import ContextMenuHeader from './ContextMenuHeader';
import ContextMenuItem from './ContextMenuItem';
import ContextMenuSeparator from './ContextMenuSeparator';
import {
  CONTEXT_MENU_ANCHOR_GAP,
  CONTEXT_MENU_WIDTH,
  type ContextMenuRow
} from './types';

type Props = {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  ariaLabel: string;
  rows?: ContextMenuRow[];
  children?: React.ReactNode;
  noDragClassName?: string;
};

function clampMenuPosition(top: number, left: number) {
  const margin = 8;
  const maxLeft = window.innerWidth - CONTEXT_MENU_WIDTH - margin;
  const clampedLeft = Math.max(margin, Math.min(left, maxLeft));
  const clampedTop = Math.max(margin, top);
  return { top: clampedTop, left: clampedLeft };
}

function renderRow(row: ContextMenuRow, onClose: () => void) {
  if (row.type === 'separator') {
    return <ContextMenuSeparator key={row.key} />;
  }
  if (row.type === 'header') {
    return <ContextMenuHeader key={row.key}>{row.label}</ContextMenuHeader>;
  }
  return (
    <ContextMenuItem
      key={row.key}
      label={row.label}
      iconClass={row.iconClass}
      shortcut={row.shortcut}
      counter={row.counter}
      slotOrder={row.slotOrder}
      disabled={row.disabled}
      onSelect={() => {
        row.onSelect?.();
        onClose();
      }}
    />
  );
}

export default function ContextMenu({
  open,
  anchorRef,
  onClose,
  ariaLabel,
  rows,
  children,
  noDragClassName = ''
}: Props) {
  const menuId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ top: number; left: number } | null>(null);
  const dragClass = noDragClassName.trim();

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setLayout(null);
      return;
    }
    const rect = anchorRef.current.getBoundingClientRect();
    const rawTop = rect.bottom + CONTEXT_MENU_ANCHOR_GAP;
    const rawLeft = rect.right - CONTEXT_MENU_WIDTH;
    setLayout(clampMenuPosition(rawTop, rawLeft));
  }, [open, anchorRef]);

  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    void hydrateArcNavbarIcons(panelRef.current);
  }, [open, rows, children, layout]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !layout) return null;

  const backdropClass = ['context-menu-backdrop', dragClass].filter(Boolean).join(' ');
  const panelClass = ['context-menu', 'panel', 'elevation-raised', 'arc-ui-kit-scope', dragClass]
    .filter(Boolean)
    .join(' ');

  return createPortal(
    <>
      <button type="button" className={backdropClass} aria-label="Закрыть меню" onClick={onClose} />
      <div
        ref={panelRef}
        id={menuId}
        role="menu"
        aria-label={ariaLabel}
        className={panelClass}
        data-elevation="raised"
        data-typo-tone="white"
        data-input-size="s"
        data-btn-size="m"
        style={{ top: layout.top, left: layout.left, width: CONTEXT_MENU_WIDTH }}
      >
        <div className="context-menu__list">
          {rows?.map((row) => renderRow(row, onClose))}
          {children}
        </div>
      </div>
    </>,
    document.body
  );
}

export type { ContextMenuRow } from './types';
