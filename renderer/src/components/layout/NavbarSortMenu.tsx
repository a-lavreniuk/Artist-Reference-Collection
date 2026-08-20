import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  templateFieldLabel,
  type CustomFieldType
} from '@arc-main-shared/detailCardTemplate';
import { ContextMenu, type ContextMenuRow } from '../context-menu';
import { useGalleryFilters } from '../gallery/GalleryFilterContext';
import { useLibrarySettings } from '../../hooks/useLibrarySettings';
import {
  GALLERY_ORDERABLE_SORT_FIELDS,
  SORT_DIRECTION_OPTIONS,
  SORT_FIELD_LABELS,
  createGalleryShuffleSort,
  customSortFieldId,
  defaultSortDirectionForField,
  isGalleryShuffleSort,
  parseCustomSortFieldId,
  type GalleryOrderableSortField,
  type GallerySortDirection
} from '../gallery/galleryFilterTypes';
import { listedUserFilterFields } from '../gallery/userFilterFields';
import { newShuffleSeed } from '../gallery/shuffleCardIds';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';

type Props = {
  disabled?: boolean;
};

function customSortDirectionOptions(type: CustomFieldType): {
  primary: GallerySortDirection;
  primaryLabel: string;
  secondary: GallerySortDirection;
  secondaryLabel: string;
} {
  if (type === 'date') {
    return {
      primary: 'desc',
      primaryLabel: 'Сначала поздние',
      secondary: 'asc',
      secondaryLabel: 'Сначала ранние'
    };
  }
  return {
    primary: 'asc',
    primaryLabel: 'А → Я',
    secondary: 'desc',
    secondaryLabel: 'Я → А'
  };
}

export default function NavbarSortMenu({ disabled = false }: Props) {
  const location = useLocation();
  const showShuffleSort = location.pathname === '/gallery';
  const anchorRef = useRef<HTMLButtonElement>(null);
  const scopeRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const { sort, setSort, shuffleReloading, stats } = useGalleryFilters();
  const { template } = useLibrarySettings();
  const userFields = listedUserFilterFields(template, stats?.customPresence);

  useLayoutEffect(() => {
    const el = scopeRef.current ?? anchorRef.current;
    if (el) void hydrateArcNavbarIcons(el);
  }, [open, sort, shuffleReloading, userFields]);

  const sortRows = useMemo<ContextMenuRow[]>(() => {
    const items: ContextMenuRow[] = [{ type: 'header', key: 'sort-sys', label: 'Системные' }];
    for (const field of GALLERY_ORDERABLE_SORT_FIELDS) {
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
    if (userFields.length > 0) {
      items.push({ type: 'header', key: 'sort-user', label: 'Пользовательские' });
      for (const field of userFields) {
        const sortField = customSortFieldId(field.id);
        items.push({
          type: 'item',
          key: `sort-${sortField}`,
          label: templateFieldLabel(field),
          selected: sort.field === sortField,
          closeOnSelect: false,
          onSelect: () =>
            setSort({
              field: sortField,
              direction:
                sort.field === sortField
                  ? sort.direction
                  : customSortDirectionOptions(field.type).primary
            })
        });
      }
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
      const customId = parseCustomSortFieldId(sort.field);
      const customField = customId ? template.fields.find((field) => field.id === customId) : undefined;
      const dirOpts = customField
        ? customSortDirectionOptions(customField.type)
        : SORT_DIRECTION_OPTIONS[sort.field as GalleryOrderableSortField];
      if (dirOpts) {
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
    }
    return items;
  }, [setSort, showShuffleSort, shuffleReloading, sort, template.fields, userFields]);

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
