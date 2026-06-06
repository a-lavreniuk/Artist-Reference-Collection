import { useMemo, useRef, useState } from 'react';
import { ContextMenu, type ContextMenuRow } from '../context-menu';
import { useGridSize, type GridSize } from '../../layout/gridSizePreference';

const GRID_OPTIONS: { key: GridSize; label: string; iconClass: string }[] = [
  { key: 'l', label: 'Большая', iconClass: 'arc-icon-grid-l' },
  { key: 'm', label: 'Средняя', iconClass: 'arc-icon-grid-m' },
  { key: 's', label: 'Маленькая', iconClass: 'arc-icon-grid-s' }
];

export default function NavbarGridSizeMenu() {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [gridSize, setGridSize] = useGridSize();

  const rows = useMemo<ContextMenuRow[]>(
    () => [
      { type: 'header', key: 'grid-size-title', label: 'Размер сетки' },
      ...GRID_OPTIONS.map((opt) => ({
        type: 'item' as const,
        key: opt.key,
        label: opt.label,
        iconClass: opt.iconClass,
        selected: gridSize === opt.key,
        onSelect: () => setGridSize(opt.key)
      }))
    ],
    [gridSize, setGridSize]
  );

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="btn btn-outline btn-ds btn-icon-only"
        aria-label="Размер сетки"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="btn-icon-only__glyph arc-icon-grid" aria-hidden="true" />
      </button>
      <ContextMenu
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        rows={rows}
        ariaLabel="Размер сетки"
        noDragClassName="arc-navbar-no-drag"
      />
    </>
  );
}
