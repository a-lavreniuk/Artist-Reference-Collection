import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ContextMenu, type ContextMenuRow } from '../context-menu';
import { useGalleryFilters } from '../gallery/GalleryFilterContext';
import {
  GALLERY_ORDERABLE_SORT_FIELDS,
  SORT_DIRECTION_OPTIONS,
  SORT_FIELD_LABELS,
  createGalleryShuffleSort,
  defaultSortDirectionForField,
  isGalleryShuffleSort,
  type GalleryOrderableSortField
} from '../gallery/galleryFilterTypes';
import { newShuffleSeed } from '../gallery/shuffleCardIds';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';

type Props = {
  disabled?: boolean;
};

export default function NavbarSortMenu({ disabled = false }: Props) {
  const location = useLocation();
  const showShuffleSort = location.pathname === '/gallery';
  const anchorRef = useRef<HTMLButtonElement>(null);
  const scopeRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const { sort, setSort, shuffleReloading } = useGalleryFilters();

  useLayoutEffect(() => {
    const el = scopeRef.current ?? anchorRef.current;
    if (el) void hydrateArcNavbarIcons(el);
  }, [open, sort, shuffleReloading]);

  const sortRows = useMemo<ContextMenuRow[]>(() => {
    const fields: GalleryOrderableSortField[] = [...GALLERY_ORDERABLE_SORT_FIELDS];
    const items: ContextMenuRow[] = [{ type: 'header', key: 'sort-h', label: 'Сортировка' }];
    for (const field of fields) {
      items.push({
        type: 'item',
        key: `sort-${field}`,
        label: SORT_FIELD_LABELS[field],
        selected: sort.field === field,
        closeOnSelect: false,
        onSelect: () =>
          setSort({
            field,
            direction:
              sort.field === field ? sort.direction : defaultSortDirectionForField(field)
          })
      });
    }
    if (showShuffleSort) {
      items.push({
        type: 'item',
        key: 'sort-shuffle',
        label: 'Перемешать',
        closeOnSelect: false,
        loading: shuffleReloading,
        disabled: shuffleReloading,
        onSelect: () => {
          if (shuffleReloading) return;
          setSort(createGalleryShuffleSort(newShuffleSeed()));
        }
      });
    }
    if (!isGalleryShuffleSort(sort)) {
      const dirOpts = SORT_DIRECTION_OPTIONS[sort.field];
      items.push({ type: 'separator', key: 'sort-sep' });
      items.push({
        type: 'item',
        key: 'sort-primary',
        label: dirOpts.primaryLabel,
        selected: sort.direction === dirOpts.primary,
        onSelect: () => setSort({ ...sort, direction: dirOpts.primary })
      });
      items.push({
        type: 'item',
        key: 'sort-secondary',
        label: dirOpts.secondaryLabel,
        selected: sort.direction === dirOpts.secondary,
        onSelect: () => setSort({ ...sort, direction: dirOpts.secondary })
      });
    }
    return items;
  }, [setSort, showShuffleSort, shuffleReloading, sort]);

  return (
    <span ref={scopeRef} className="arc-navbar-island-action">
      <button
        ref={anchorRef}
        type="button"
        className={`btn btn-ghost btn-ds btn-m btn-icon-only${open ? ' is-active' : ''}`}
        aria-label="Сортировка"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="btn-icon-only__glyph arc-icon-sorting" aria-hidden="true" />
      </button>
      <ContextMenu
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        rows={sortRows}
        ariaLabel="Сортировка"
        noDragClassName="arc-navbar-no-drag"
      />
    </span>
  );
}
