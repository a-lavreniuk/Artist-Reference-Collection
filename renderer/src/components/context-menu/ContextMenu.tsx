import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { playMenuItemsEnter, playMenuPanelEnter } from '../../motion/playModalHostMotion';
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
export type ContextMenuAnchorAlign = 'start' | 'end';
export type ContextMenuAnchorPlacement = 'belowAnchor' | 'belowIsland' | 'aboveAnchor';

type Props = {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  rows?: ContextMenuRow[];
  children?: React.ReactNode;
  noDragClassName?: string;
  anchorRef?: React.RefObject<HTMLElement | null>;
  position?: ContextMenuPosition | null;
  /** Ширина панели; по умолчанию CONTEXT_MENU_WIDTH (250). */
  menuWidth?: number;
  /** Горизонтальное выравнивание относительно якоря. */
  anchorAlign?: ContextMenuAnchorAlign;
  /** belowAnchor — под якорем; belowIsland — под navbar-island; aboveAnchor — над якорем. */
  anchorPlacement?: ContextMenuAnchorPlacement;
  panelClassName?: string;
};

function resolveAnchorTop(anchorEl: HTMLElement): number {
  const mgmtIsland = anchorEl.closest('.arc-navbar-island--mgmt');
  const base = mgmtIsland ?? anchorEl;
  return base.getBoundingClientRect().bottom + CONTEXT_MENU_ANCHOR_GAP;
}

function clampMenuPosition(top: number, left: number, menuHeight = 0, menuWidth = CONTEXT_MENU_WIDTH) {
  const margin = 8;
  const maxLeft = window.innerWidth - menuWidth - margin;
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
  noDragClassName = '',
  menuWidth = CONTEXT_MENU_WIDTH,
  anchorAlign = 'end',
  anchorPlacement = 'belowIsland',
  panelClassName = ''
}: Props) {
  const menuId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ top: number; left: number } | null>(null);
  const menuWasOpenRef = useRef(false);
  const contentSignatureRef = useRef('');
  const dragClass = noDragClassName.trim();

  const contentSignature = `${ariaLabel}|${
    rows?.map((row) => (row.type === 'item' ? row.key : `${row.type}:${row.key}`)).join(',') ?? ''
  }|${children ? 'children' : ''}`;

  useLayoutEffect(() => {
    if (!open) {
      menuWasOpenRef.current = false;
      contentSignatureRef.current = '';
      setLayout((prev) => (prev === null ? prev : null));
      return;
    }

    const updateLayout = () => {
      const menuHeight = panelRef.current?.offsetHeight ?? 0;

      if (position) {
        const nextLayout = clampMenuPosition(position.y, position.x, menuHeight, menuWidth);
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
      const rawTop =
        anchorPlacement === 'aboveAnchor'
          ? rect.top - CONTEXT_MENU_ANCHOR_GAP - menuHeight
          : anchorPlacement === 'belowAnchor'
            ? rect.bottom + CONTEXT_MENU_ANCHOR_GAP
            : resolveAnchorTop(anchorRef.current);
      const rawLeft = anchorAlign === 'start' ? rect.left : rect.right - menuWidth;
      const nextLayout = clampMenuPosition(rawTop, rawLeft, menuHeight, menuWidth);
      setLayout((prev) =>
        prev?.top === nextLayout.top && prev?.left === nextLayout.left ? prev : nextLayout
      );
    };

    updateLayout();
  }, [open, ariaLabel, anchorRef, position, rows, children, menuWidth, anchorAlign, anchorPlacement]);

  useEffect(() => {
    if (!open) return;
    const onReflow = () => {
      if (!panelRef.current) return;
      const menuHeight = panelRef.current.offsetHeight;
      if (menuHeight <= 0) return;

      if (position) {
        const nextLayout = clampMenuPosition(position.y, position.x, menuHeight, menuWidth);
        setLayout(nextLayout);
        return;
      }
      if (!anchorRef?.current) return;

      const rect = anchorRef.current.getBoundingClientRect();
      const rawTop =
        anchorPlacement === 'aboveAnchor'
          ? rect.top - CONTEXT_MENU_ANCHOR_GAP - menuHeight
          : anchorPlacement === 'belowAnchor'
            ? rect.bottom + CONTEXT_MENU_ANCHOR_GAP
            : resolveAnchorTop(anchorRef.current);
      const rawLeft = anchorAlign === 'start' ? rect.left : rect.right - menuWidth;
      setLayout(clampMenuPosition(rawTop, rawLeft, menuHeight, menuWidth));
    };

    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open, anchorAlign, anchorPlacement, anchorRef, menuWidth, position]);

  useLayoutEffect(() => {
    if (!open || !panelRef.current || !layout) return;
    void hydrateArcNavbarIcons(panelRef.current);
  }, [open, layout, rows, children]);

  useLayoutEffect(() => {
    if (!open || !panelRef.current || !layout) return;

    const isFirstOpen = !menuWasOpenRef.current;
    const isContentSwap =
      menuWasOpenRef.current && contentSignatureRef.current !== contentSignature;

    if (!isFirstOpen && !isContentSwap) return;

    menuWasOpenRef.current = true;
    contentSignatureRef.current = contentSignature;

    if (isFirstOpen) {
      playMenuPanelEnter(panelRef.current);
    }
    playMenuItemsEnter(panelRef.current);
  }, [open, layout, contentSignature]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isPositioned = layout !== null;
  const panelTop = isPositioned ? layout.top : -10000;
  const panelLeft = isPositioned ? layout.left : -10000;

  const backdropClass = ['context-menu-backdrop', dragClass].filter(Boolean).join(' ');
  const panelClass = [
    'context-menu',
    'panel',
    'elevation-raised',
    'arc-ui-kit-scope',
    dragClass,
    panelClassName
  ]
    .filter(Boolean)
    .join(' ');

  return createPortal(
    <>
      {isPositioned ? (
        <button type="button" className={backdropClass} aria-label="Закрыть меню" onClick={onClose} />
      ) : null}
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
        style={{
          top: panelTop,
          left: panelLeft,
          width: menuWidth,
          visibility: isPositioned ? 'visible' : 'hidden',
          pointerEvents: isPositioned ? undefined : 'none'
        }}
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
