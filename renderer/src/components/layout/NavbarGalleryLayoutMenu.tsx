import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ContextMenu, type ContextMenuRow } from '../context-menu';
import { Tooltip } from '../tooltip/Tooltip';
import { useGridSize, type GridSize } from '../../layout/gridSizePreference';
import {
  useGalleryLayoutMode,
  type GalleryLayoutMode
} from '../../layout/galleryLayoutPreference';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';

const LAYOUT_OPTIONS: {
  key: GalleryLayoutMode;
  label: string;
  iconClass: string;
}[] = [
  { key: 'masonry', label: 'Плитка', iconClass: 'arc-icon-grid' },
  { key: 'grid', label: 'Сетка', iconClass: 'arc-icon-grid-l' },
  { key: 'list', label: 'Строки', iconClass: 'arc-icon-layout-list' }
];

const GRID_OPTIONS: { key: GridSize; label: string; iconClass: string }[] = [
  { key: 'l', label: 'Большая', iconClass: 'arc-icon-grid-l' },
  { key: 'm', label: 'Средняя', iconClass: 'arc-icon-grid-m' },
  { key: 's', label: 'Маленькая', iconClass: 'arc-icon-grid-s' }
];

function layoutButtonIcon(mode: GalleryLayoutMode): string {
  return LAYOUT_OPTIONS.find((o) => o.key === mode)?.iconClass ?? 'arc-icon-grid';
}

type Props = {
  disabled?: boolean;
};

export default function NavbarGalleryLayoutMenu({ disabled = false }: Props) {
  const scopeRef = useRef<HTMLSpanElement>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useGalleryLayoutMode();
  const [gridSize, setGridSize] = useGridSize();
  const sizeDisabled = layoutMode === 'list';

  useLayoutEffect(() => {
    const el = scopeRef.current ?? anchorRef.current;
    if (el) void hydrateArcNavbarIcons(el);
  }, [open, layoutMode, gridSize]);

  const rows = useMemo<ContextMenuRow[]>(
    () => [
      { type: 'header', key: 'layout-title', label: 'Вид' },
      ...LAYOUT_OPTIONS.map((opt) => ({
        type: 'item' as const,
        key: `layout-${opt.key}`,
        label: opt.label,
        iconClass: opt.iconClass,
        selected: layoutMode === opt.key,
        closeOnSelect: false,
        onSelect: () => setLayoutMode(opt.key)
      })),
      { type: 'separator', key: 'sep-size' },
      { type: 'header', key: 'grid-size-title', label: 'Размер сетки' },
      ...GRID_OPTIONS.map((opt) => ({
        type: 'item' as const,
        key: `grid-${opt.key}`,
        label: opt.label,
        iconClass: opt.iconClass,
        selected: gridSize === opt.key,
        disabled: sizeDisabled,
        closeOnSelect: false,
        onSelect: () => {
          if (sizeDisabled) return;
          setGridSize(opt.key);
        }
      }))
    ],
    [gridSize, layoutMode, setGridSize, setLayoutMode, sizeDisabled]
  );

  const button = (
    <button
      ref={anchorRef}
      type="button"
      className={`btn btn-ghost btn-ds btn-m btn-icon-only${open ? ' is-active' : ''}`}
      aria-label="Вид галереи"
      aria-expanded={open}
      aria-haspopup="menu"
      disabled={disabled}
      onClick={() => setOpen((v) => !v)}
    >
      <span className={`btn-icon-only__glyph ${layoutButtonIcon(layoutMode)}`} aria-hidden="true" />
    </button>
  );

  return (
    <span ref={scopeRef} className="arc-navbar-island-action">
      {disabled ? (
        <span className="arc-tooltip-anchor-inline">{button}</span>
      ) : (
        <Tooltip content="Вид галереи" delay={500} position="bottom">
          {button}
        </Tooltip>
      )}
      <ContextMenu
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        rows={rows}
        ariaLabel="Вид галереи"
        noDragClassName="arc-navbar-no-drag"
      />
    </span>
  );
}
