import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { playMenuPanelEnter } from '../../motion/playModalHostMotion';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import ContextMenuHeader from './ContextMenuHeader';
import ContextMenuItem from './ContextMenuItem';
import ContextMenuSeparator from './ContextMenuSeparator';
import {
  CONTEXT_MENU_ANCHOR_GAP,
  CONTEXT_MENU_WIDTH,
  type ContextMenuRow
} from './types';

export type ContextMenuPosition = { x: number; y: number };

type Props = {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  rows?: ContextMenuRow[];
  children?: React.ReactNode;
  noDragClassName?: string;
  anchorRef?: React.RefObject<HTMLElement | null>;
  position?: ContextMenuPosition | null;
};

function resolveAnchorTop(anchorEl: HTMLElement): number {
  const mgmtIsland = anchorEl.closest('.arc-navbar-island--mgmt');
  const base = mgmtIsland ?? anchorEl;
  return base.getBoundingClientRect().bottom + CONTEXT_MENU_ANCHOR_GAP;
}

function clampMenuPosition(top: number, left: number, menuHeight = 0) {
  const margin = 8;
  const maxLeft = window.innerWidth - CONTEXT_MENU_WIDTH - margin;
  const clampedLeft = Math.max(margin, Math.min(left, maxLeft));
  const maxTop =
    menuHeight > 0 ? window.innerHeight - menuHeight - margin : Number.POSITIVE_INFINITY;
  const clampedTop = Math.max(margin, Math.min(top, maxTop));
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
      menuKey={row.key}
      label={row.label}
      iconClass={row.iconClass}
      shortcut={row.shortcut}
      counter={row.counter}
      slotOrder={row.slotOrder}
      selected={row.selected}
      disabled={row.disabled}
      loading={row.loading}
      onSelect={() => {
        row.onSelect?.();
        if (row.closeOnSelect !== false) onClose();
      }}
    />
  );
}

export default function ContextMenu({
  open,
  anchorRef,
  position = null,
  onClose,
  ariaLabel,
  rows,
  children,
  noDragClassName = ''
}: Props) {
  const menuId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ top: number; left: number } | null>(null);
  const menuWasOpenRef = useRef(false);
  const dragClass = noDragClassName.trim();

  useLayoutEffect(() => {
    if (!open) {
      menuWasOpenRef.current = false;
      setLayout((prev) => (prev === null ? prev : null));
      return;
    }

    const menuHeight = panelRef.current?.offsetHeight ?? 0;

    if (position) {
      const nextLayout = clampMenuPosition(position.y, position.x, menuHeight);
      setLayout((prev) =>
        prev?.top === nextLayout.top && prev?.left === nextLayout.left ? prev : nextLayout
      );
      return;
    }

    if (!anchorRef?.current) {
      setLayout((prev) => (prev === null ? prev : null));
      return;
    }

    const rect = anchorRef.current.getBoundingClientRect();
    const rawTop = resolveAnchorTop(anchorRef.current);
    const rawLeft = rect.right - CONTEXT_MENU_WIDTH;
    const nextLayout = clampMenuPosition(rawTop, rawLeft, menuHeight);
    setLayout((prev) =>
      prev?.top === nextLayout.top && prev?.left === nextLayout.left ? prev : nextLayout
    );
  }, [open, ariaLabel, anchorRef, position, rows, children]);

  useLayoutEffect(() => {
    if (!open || !panelRef.current || !layout) return;
    void hydrateArcNavbarIcons(panelRef.current);
  }, [open, layout, rows, children]);

  useLayoutEffect(() => {
    if (!open || !panelRef.current || !layout) return;
    if (menuWasOpenRef.current) return;
    menuWasOpenRef.current = true;
    playMenuPanelEnter(panelRef.current);
  }, [open, layout]);

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
