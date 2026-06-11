import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ContextMenu, ContextMenuInput, type ContextMenuRow } from '../../context-menu';
import ContextMenuItem from '../../context-menu/ContextMenuItem';
import ContextMenuHeader from '../../context-menu/ContextMenuHeader';
import ContextMenuSeparator from '../../context-menu/ContextMenuSeparator';
import RangeSlider from '../../range-slider/RangeSlider';
import { Tooltip } from '../../tooltip/Tooltip';
import { useGalleryFilters } from '../../gallery/GalleryFilterContext';
import {
  FILTER_CHIP_META,
  IMAGE_FILE_EXTENSIONS,
  SORT_FIELD_LABELS,
  VIDEO_FILE_EXTENSIONS,
  isFilterCategoryActive,
  type AspectRatioFilterValue,
  type DateAddedFilterValue,
  type DurationFilterValue,
  type FileWeightFilterValue,
  type GalleryFilterId,
  type GallerySortField,
  type ResolutionFilterValue
} from '../../gallery/galleryFilterTypes';
import { hydrateArcNavbarIcons } from '../navbarIconHydrate';
import FilterPresetModal from './FilterPresetModal';

function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function formatMb(v: number): string {
  return `${Math.round(v * 10) / 10} Мб`;
}

function formatMinutes(ms: number): string {
  const m = Math.round(ms / 60_000);
  return `${m} мин`;
}

export default function GalleryNavbarFilters() {
  const rowRef = useRef<HTMLDivElement>(null);
  const {
    filters,
    patchFilters,
    clearFilters,
    sort,
    setSort,
    layout,
    moveFilter,
    toggleFilterVisibility,
    stats,
    presets,
    savePreset,
    applyPreset,
    deletePreset,
    activeCategoryCount
  } = useGalleryFilters();

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [descKeywords, setDescKeywords] = useState('');
  const [linkKeywords, setLinkKeywords] = useState('');
  const [customWeight, setCustomWeight] = useState({ min: 0, max: 10 });
  const [customRes, setCustomRes] = useState({ minW: 0, maxW: 3840, minH: 0, maxH: 2160 });
  const [customDuration, setCustomDuration] = useState({ min: 0, max: 60 });
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');

  const sortRef = useRef<HTMLButtonElement>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const optionsRef = useRef<HTMLButtonElement>(null);
  const presetsRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (rowRef.current) void hydrateArcNavbarIcons(rowRef.current);
  }, [layout, filters, sort, openMenu, activeCategoryCount, stats]);

  const closeMenu = useCallback(() => setOpenMenu(null), []);

  const sortRows = useMemo<ContextMenuRow[]>(() => {
    const fields: GallerySortField[] = ['addedAt', 'fileType', 'fileWeight', 'resolution', 'duration'];
    const items: ContextMenuRow[] = [{ type: 'header', key: 'sort-h', label: 'Сортировка' }];
    for (const field of fields) {
      items.push({
        type: 'item',
        key: `sort-${field}`,
        label: SORT_FIELD_LABELS[field],
        selected: sort.field === field,
        closeOnSelect: false,
        onSelect: () => setSort({ field, direction: sort.field === field ? sort.direction : 'desc' })
      });
    }
    items.push({ type: 'separator', key: 'sort-sep' });
    items.push({
      type: 'item',
      key: 'sort-asc',
      label: 'По увеличению',
      selected: sort.direction === 'asc',
      onSelect: () => setSort({ ...sort, direction: 'asc' })
    });
    items.push({
      type: 'item',
      key: 'sort-desc',
      label: 'По уменьшению',
      selected: sort.direction === 'desc',
      onSelect: () => setSort({ ...sort, direction: 'desc' })
    });
    return items;
  }, [setSort, sort]);

  const buildAspectRows = (): ContextMenuRow[] => {
    const opts: { key: AspectRatioFilterValue; label: string }[] = [
      { key: 'horizontal', label: 'Горизонтальное' },
      { key: 'vertical', label: 'Вертикальное' },
      { key: 'square', label: 'Квадрат' },
      { key: 'panoramic', label: 'Панорамное' }
    ];
    return opts
      .filter((o) => (stats?.aspectRatio[o.key] ?? 0) > 0)
      .map((o) => ({
        type: 'item' as const,
        key: o.key,
        label: o.label,
        counter: stats?.aspectRatio[o.key],
        selected: filters.aspectRatios.includes(o.key),
        closeOnSelect: false,
        onSelect: () =>
          patchFilters({ aspectRatios: toggleInList(filters.aspectRatios, o.key) })
      }));
  };

  const buildFileTypeRows = (): ContextMenuRow[] => {
    const rows: ContextMenuRow[] = [{ type: 'header', key: 'ft-img', label: 'Изображения' }];
    for (const ext of IMAGE_FILE_EXTENSIONS) {
      const n = stats?.fileExtensions[ext] ?? 0;
      if (n <= 0) continue;
      rows.push({
        type: 'item',
        key: `ext-${ext}`,
        label: ext,
        counter: n,
        selected: filters.fileExtensions.includes(ext),
        closeOnSelect: false,
        onSelect: () =>
          patchFilters({ fileExtensions: toggleInList(filters.fileExtensions, ext) })
      });
    }
    rows.push({ type: 'separator', key: 'ft-sep' });
    rows.push({ type: 'header', key: 'ft-vid', label: 'Видео' });
    for (const ext of VIDEO_FILE_EXTENSIONS) {
      const n = stats?.fileExtensions[ext] ?? 0;
      if (n <= 0) continue;
      rows.push({
        type: 'item',
        key: `ext-${ext}`,
        label: ext,
        counter: n,
        selected: filters.fileExtensions.includes(ext),
        closeOnSelect: false,
        onSelect: () =>
          patchFilters({ fileExtensions: toggleInList(filters.fileExtensions, ext) })
      });
    }
    return rows;
  };

  const buildDescriptionMenu = () => (
    <>
      <ContextMenuHeader>Описание</ContextMenuHeader>
      <ContextMenuItem
        label="Есть"
        counter={stats?.description.has}
        selected={filters.description?.mode === 'has'}
        onSelect={() =>
          patchFilters({
            description: { mode: 'has', keywords: descKeywords || filters.description?.keywords }
          })
        }
      />
      <ContextMenuItem
        label="Нет"
        counter={stats?.description.missing}
        selected={filters.description?.mode === 'missing'}
        onSelect={() => patchFilters({ description: { mode: 'missing' } })}
      />
      {filters.description?.mode === 'has' ? (
        <ContextMenuInput
          variant="live"
          label="Ключевые слова"
          placeholder="Ключевые слова"
          value={descKeywords || filters.description.keywords || ''}
          onChange={(v) => {
            setDescKeywords(v);
            patchFilters({ description: { mode: 'has', keywords: v } });
          }}
        />
      ) : null}
    </>
  );

  const buildLinkMenu = () => (
    <>
      <ContextMenuHeader>Ссылка</ContextMenuHeader>
      <ContextMenuItem
        label="Есть"
        counter={stats?.link.has}
        selected={filters.link?.mode === 'has'}
        onSelect={() =>
          patchFilters({ link: { mode: 'has', keywords: linkKeywords || filters.link?.keywords } })
        }
      />
      <ContextMenuItem
        label="Нет"
        counter={stats?.link.missing}
        selected={filters.link?.mode === 'missing'}
        onSelect={() => patchFilters({ link: { mode: 'missing' } })}
      />
      {filters.link?.mode === 'has' ? (
        <ContextMenuInput
          variant="live"
          label="Ключевые слова"
          placeholder="Ключевые слова"
          value={linkKeywords || filters.link.keywords || ''}
          onChange={(v) => {
            setLinkKeywords(v);
            patchFilters({ link: { mode: 'has', keywords: v } });
          }}
        />
      ) : null}
    </>
  );

  const buildDateRows = (): ContextMenuRow[] => {
    const presets: { key: DateAddedFilterValue['preset']; label: string }[] = [
      { key: 'today', label: 'Сегодня' },
      { key: 'yesterday', label: 'Вчера' },
      { key: 'week', label: 'Неделя' },
      { key: 'month', label: 'Месяц' },
      { key: 'threeMonths', label: '3 месяца' },
      { key: 'year', label: 'Год' }
    ];
    const rows: ContextMenuRow[] = [{ type: 'header', key: 'date-h', label: 'Дата добавления' }];
    for (const p of presets) {
      rows.push({
        type: 'item',
        key: p.key,
        label: p.label,
        counter: stats?.dateAdded[p.key],
        selected: filters.dateAdded.some((d) => d.preset === p.key),
        closeOnSelect: false,
        onSelect: () => {
          const has = filters.dateAdded.some((d) => d.preset === p.key);
          const next = has
            ? filters.dateAdded.filter((d) => d.preset !== p.key)
            : [...filters.dateAdded, { preset: p.key }];
          patchFilters({ dateAdded: next as DateAddedFilterValue[] });
        }
      });
    }
    rows.push({
      type: 'item',
      key: 'custom-date',
      label: 'Другой период',
      selected: filters.dateAdded.some((d) => d.preset === 'custom'),
      closeOnSelect: false,
      onSelect: () => {
        if (!customDateFrom) return;
        const entry: DateAddedFilterValue = {
          preset: 'custom',
          from: customDateFrom,
          to: customDateTo || customDateFrom
        };
        patchFilters({ dateAdded: [entry] });
      }
    });
    return rows;
  };

  const buildWeightRows = (): ContextMenuRow[] => {
    const b = stats?.weightBuckets;
    if (!b) return [];
    const rows: ContextMenuRow[] = [{ type: 'header', key: 'w-h', label: 'Вес файла' }];
    const buckets: { key: FileWeightFilterValue['preset']; label: string; counterKey: string }[] = [
      { key: 'bucket1', label: `До ${b.b1} Мб`, counterKey: 'bucket1' },
      { key: 'bucket2', label: `${b.b1}–${b.b2} Мб`, counterKey: 'bucket2' },
      { key: 'bucket3', label: `${b.b2}–${b.b3} Мб`, counterKey: 'bucket3' },
      { key: 'bucket4', label: `Более ${b.b3} Мб`, counterKey: 'bucket4' }
    ];
    for (const bucket of buckets) {
      const n = stats?.fileWeight[bucket.counterKey] ?? 0;
      if (n <= 0) continue;
      rows.push({
        type: 'item',
        key: bucket.key,
        label: bucket.label,
        counter: n,
        selected: filters.fileWeight.some((w) => w.preset === bucket.key),
        closeOnSelect: false,
        onSelect: () => {
          const preset = bucket.key as Exclude<FileWeightFilterValue['preset'], 'custom'>;
          const has = filters.fileWeight.some((w) => w.preset === preset);
          const next = has
            ? filters.fileWeight.filter((w) => w.preset !== preset)
            : [...filters.fileWeight.filter((w) => w.preset !== 'custom'), { preset }];
          patchFilters({ fileWeight: next as FileWeightFilterValue[] });
        }
      });
    }
    rows.push({
      type: 'item',
      key: 'custom-weight',
      label: 'Другой вес',
      selected: filters.fileWeight.some((w) => w.preset === 'custom'),
      closeOnSelect: false,
      onSelect: () =>
        patchFilters({
          fileWeight: [{ preset: 'custom', minMb: customWeight.min, maxMb: customWeight.max }]
        })
    });
    return rows;
  };

  const buildResolutionRows = (): ContextMenuRow[] => {
    const rows: ContextMenuRow[] = [{ type: 'header', key: 'res-h', label: 'Разрешение' }];
    for (const preset of ['720p', '1080p', '4k'] as const) {
      const n = stats?.resolution[preset] ?? 0;
      if (n <= 0) continue;
      rows.push({
        type: 'item',
        key: preset,
        label: preset.toUpperCase(),
        counter: n,
        selected: filters.resolution.some((r) => r.preset === preset),
        closeOnSelect: false,
        onSelect: () => {
          const has = filters.resolution.some((r) => r.preset === preset);
          const next = has
            ? filters.resolution.filter((r) => r.preset !== preset)
            : [...filters.resolution.filter((r) => r.preset !== 'custom'), { preset }];
          patchFilters({ resolution: next as ResolutionFilterValue[] });
        }
      });
    }
    rows.push({
      type: 'item',
      key: 'custom-res',
      label: 'Другое',
      selected: filters.resolution.some((r) => r.preset === 'custom'),
      closeOnSelect: false,
      onSelect: () =>
        patchFilters({
          resolution: [
            {
              preset: 'custom',
              minWidth: customRes.minW,
              maxWidth: customRes.maxW,
              minHeight: customRes.minH,
              maxHeight: customRes.maxH
            }
          ]
        })
    });
    return rows;
  };

  const buildDurationRows = (): ContextMenuRow[] => {
    const defs: { key: DurationFilterValue['preset']; label: string }[] = [
      { key: 'up5', label: 'До 5 мин' },
      { key: '5to15', label: '5–15 мин' },
      { key: '15to30', label: '15–30 мин' },
      { key: '30to60', label: '30–60 мин' },
      { key: 'over60', label: 'Более 1 ч' }
    ];
    const rows: ContextMenuRow[] = [{ type: 'header', key: 'dur-h', label: 'Длительность' }];
    for (const d of defs) {
      const n = stats?.duration[d.key] ?? 0;
      if (n <= 0) continue;
      rows.push({
        type: 'item',
        key: d.key,
        label: d.label,
        counter: n,
        selected: filters.duration.some((x) => x.preset === d.key),
        closeOnSelect: false,
        onSelect: () => {
          const has = filters.duration.some((x) => x.preset === d.key);
          const next = has
            ? filters.duration.filter((x) => x.preset !== d.key)
            : [...filters.duration.filter((x) => x.preset !== 'custom'), { preset: d.key }];
          patchFilters({ duration: next as DurationFilterValue[] });
        }
      });
    }
    rows.push({
      type: 'item',
      key: 'custom-dur',
      label: 'Свой диапазон',
      selected: filters.duration.some((x) => x.preset === 'custom'),
      closeOnSelect: false,
      onSelect: () =>
        patchFilters({
          duration: [
            { preset: 'custom', minMinutes: customDuration.min, maxMinutes: customDuration.max }
          ]
        })
    });
    return rows;
  };

  const optionsRows = useMemo<ContextMenuRow[]>(() => {
    const rows: ContextMenuRow[] = [{ type: 'header', key: 'opt-h', label: 'Список фильтров' }];
    for (const id of layout.order) {
      const meta = FILTER_CHIP_META[id];
      rows.push({
        type: 'item',
        key: `vis-${id}`,
        label: meta.label,
        iconClass: 'arc-icon-eye',
        selected: layout.visible[id],
        closeOnSelect: false,
        onSelect: () => toggleFilterVisibility(id)
      });
      rows.push({
        type: 'item',
        key: `up-${id}`,
        label: 'Вверх',
        iconClass: 'arc-icon-arrow-up',
        closeOnSelect: false,
        onSelect: () => moveFilter(id, 'up')
      });
      rows.push({
        type: 'item',
        key: `down-${id}`,
        label: 'Вниз',
        iconClass: 'arc-icon-arrow-down',
        closeOnSelect: false,
        onSelect: () => moveFilter(id, 'down')
      });
      rows.push({ type: 'separator', key: `sep-${id}` });
    }
    return rows;
  }, [layout, moveFilter, toggleFilterVisibility]);

  const presetRows = useMemo<ContextMenuRow[]>(() => {
    const rows: ContextMenuRow[] = [
      { type: 'header', key: 'pre-h', label: 'Пресеты' },
      {
        type: 'item',
        key: 'save-preset',
        label: 'Сохранить текущий',
        iconClass: 'arc-icon-save',
        onSelect: () => setPresetModalOpen(true)
      }
    ];
    if (presets.length) rows.push({ type: 'separator', key: 'pre-sep' });
    for (const p of presets) {
      rows.push({
        type: 'item',
        key: p.id,
        label: p.name,
        closeOnSelect: false,
        onSelect: () => applyPreset(p)
      });
      rows.push({
        type: 'item',
        key: `del-${p.id}`,
        label: 'Удалить',
        iconClass: 'arc-icon-trash',
        onSelect: () => void deletePreset(p.id)
      });
    }
    return rows;
  }, [applyPreset, deletePreset, presets]);

  const visibleChips = layout.order.filter((id) => {
    if (!layout.visible[id]) return false;
    if (id === 'duration' && stats && !stats.hasVideo) return false;
    return true;
  });

  const renderChipMenu = (id: GalleryFilterId) => {
    const anchorRef = { current: chipRefs.current[id] ?? null };
    const open = openMenu === id;
    const meta = FILTER_CHIP_META[id];
    const active = isFilterCategoryActive(filters, id);

    let rows: ContextMenuRow[] | null = null;
    let children: React.ReactNode = null;

    switch (id) {
      case 'aspectRatio':
        rows = buildAspectRows();
        break;
      case 'fileType':
        rows = buildFileTypeRows();
        break;
      case 'description':
        children = buildDescriptionMenu();
        break;
      case 'link':
        children = buildLinkMenu();
        break;
      case 'dateAdded':
        rows = buildDateRows();
        children =
          openMenu === 'dateAdded' ? (
            <div className="context-menu__slot arc-navbar-no-drag">
              <label className="field input-live">
                <input
                  className="input"
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                />
              </label>
              <label className="field input-live">
                <input
                  className="input"
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                />
              </label>
            </div>
          ) : null;
        break;
      case 'fileWeight':
        rows = buildWeightRows();
        children =
          openMenu === 'fileWeight' && stats ? (
            <div className="context-menu__slot arc-navbar-no-drag">
              <RangeSlider
                min={0}
                max={stats.weightBuckets.maxMb}
                step={0.1}
                valueMin={customWeight.min}
                valueMax={customWeight.max}
                formatValue={formatMb}
                onChange={(min, max) => setCustomWeight({ min, max })}
              />
            </div>
          ) : null;
        break;
      case 'resolution':
        rows = buildResolutionRows();
        children =
          openMenu === 'resolution' ? (
            <div className="context-menu__slot arc-navbar-no-drag">
              <ContextMenuInput
                variant="live"
                label="Мин. ширина"
                value={String(customRes.minW)}
                onChange={(v) => setCustomRes((s) => ({ ...s, minW: Number(v) || 0 }))}
              />
              <ContextMenuInput
                variant="live"
                label="Макс. ширина"
                value={String(customRes.maxW)}
                onChange={(v) => setCustomRes((s) => ({ ...s, maxW: Number(v) || 0 }))}
              />
              <ContextMenuInput
                variant="live"
                label="Мин. высота"
                value={String(customRes.minH)}
                onChange={(v) => setCustomRes((s) => ({ ...s, minH: Number(v) || 0 }))}
              />
              <ContextMenuInput
                variant="live"
                label="Макс. высота"
                value={String(customRes.maxH)}
                onChange={(v) => setCustomRes((s) => ({ ...s, maxH: Number(v) || 0 }))}
              />
            </div>
          ) : null;
        break;
      case 'duration':
        rows = buildDurationRows();
        children =
          openMenu === 'duration' && stats ? (
            <div className="context-menu__slot arc-navbar-no-drag">
              <RangeSlider
                min={0}
                max={Math.max(1, Math.ceil(stats.maxDurationMs / 60_000))}
                step={1}
                valueMin={customDuration.min}
                valueMax={customDuration.max}
                formatValue={(v) => formatMinutes(v * 60_000)}
                onChange={(min, max) => setCustomDuration({ min, max })}
              />
            </div>
          ) : null;
        break;
      default:
        break;
    }

    return (
      <>
        <button
          ref={(el) => {
            chipRefs.current[id] = el;
          }}
          type="button"
          className={`btn btn-ghost btn-ds btn-m arc-navbar-filter-chip${active ? ' is-active' : ''}`}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpenMenu(open ? null : id)}
        >
          <span className={`btn-ds__icon ${meta.iconClass}`} aria-hidden="true" />
          <span className="btn-ds__value">{meta.label}</span>
        </button>
        <ContextMenu
          open={open}
          anchorRef={anchorRef}
          onClose={closeMenu}
          rows={rows ?? undefined}
          ariaLabel={meta.label}
          noDragClassName="arc-navbar-no-drag"
        >
          {children}
        </ContextMenu>
      </>
    );
  };

  const presetNames = useMemo(
    () => new Set(presets.map((p) => p.name.trim().toLowerCase())),
    [presets]
  );

  return (
    <>
      <div
        ref={rowRef}
        className="arc-navbar-filters-row arc-navbar-no-drag arc-ui-kit-scope"
        data-btn-size="m"
        data-elevation="default"
      >
        <button
          ref={sortRef}
          type="button"
          className="btn btn-outline btn-ds btn-m arc-navbar-filter-sort"
          aria-expanded={openMenu === 'sort'}
          aria-haspopup="menu"
          onClick={() => setOpenMenu(openMenu === 'sort' ? null : 'sort')}
        >
          <span className="btn-ds__icon arc-icon-sorting" aria-hidden="true" />
          <span className="btn-ds__value">Сортировка</span>
        </button>
        <ContextMenu
          open={openMenu === 'sort'}
          anchorRef={sortRef}
          onClose={closeMenu}
          rows={sortRows}
          ariaLabel="Сортировка"
          noDragClassName="arc-navbar-no-drag"
        />

        <div className="arc-navbar-filters-row__chips">
          {visibleChips.map((id) => (
            <span key={id}>{renderChipMenu(id)}</span>
          ))}
        </div>

        <div className="btn-group btn-group-ds arc-navbar-filters-options">
          <button
            ref={optionsRef}
            type="button"
            className="btn btn-ds btn-m btn-icon-only"
            aria-label="Список фильтров"
            aria-expanded={openMenu === 'options'}
            aria-haspopup="menu"
            onClick={() => setOpenMenu(openMenu === 'options' ? null : 'options')}
          >
            <span className="btn-icon-only__glyph arc-icon-filter-list" aria-hidden="true" />
          </button>
          <ContextMenu
            open={openMenu === 'options'}
            anchorRef={optionsRef}
            onClose={closeMenu}
            rows={optionsRows}
            ariaLabel="Список фильтров"
            noDragClassName="arc-navbar-no-drag"
          />

          <button
            ref={presetsRef}
            type="button"
            className="btn btn-ds btn-m btn-icon-only"
            aria-label="Пресеты"
            aria-expanded={openMenu === 'presets'}
            aria-haspopup="menu"
            onClick={() => setOpenMenu(openMenu === 'presets' ? null : 'presets')}
          >
            <span className="btn-icon-only__glyph arc-icon-save" aria-hidden="true" />
          </button>
          <ContextMenu
            open={openMenu === 'presets'}
            anchorRef={presetsRef}
            onClose={closeMenu}
            rows={presetRows}
            ariaLabel="Пресеты"
            noDragClassName="arc-navbar-no-drag"
          />

          <Tooltip content="Очистить фильтры" delay={500} position="top">
            <button
              type="button"
              className="btn btn-ds btn-m btn-icon-only"
              aria-label={`Очистить фильтры${activeCategoryCount ? ` (${activeCategoryCount})` : ''}`}
              disabled={activeCategoryCount === 0}
              onClick={clearFilters}
            >
              <span className="btn-icon-only__glyph arc-icon-trash" aria-hidden="true" />
              {activeCategoryCount > 0 ? (
                <span className="btn-icon-only__badge" aria-hidden="true">
                  {activeCategoryCount}
                </span>
              ) : null}
            </button>
          </Tooltip>
        </div>
      </div>

      {presetModalOpen ? (
        <FilterPresetModal
          title="Сохранить пресет"
          submitLabel="Сохранить"
          existingLowerNames={presetNames}
          onClose={() => setPresetModalOpen(false)}
          onSubmit={savePreset}
        />
      ) : null}
    </>
  );
}
