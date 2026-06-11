import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type RefObject
} from 'react';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { ContextMenu, ContextMenuInput, type ContextMenuRow } from '../../context-menu';
import type { ContextMenuSlot } from '../../context-menu/types';
import ContextMenuItem from '../../context-menu/ContextMenuItem';
import ContextMenuSeparator from '../../context-menu/ContextMenuSeparator';
import { Datepicker } from '../../datepicker';
import RangeSlider from '../../range-slider/RangeSlider';
import { Tooltip } from '../../tooltip/Tooltip';
import { useGalleryFilters } from '../../gallery/GalleryFilterContext';
import {
  FILTER_CHIP_META,
  IMAGE_FILE_EXTENSIONS,
  SORT_DIRECTION_OPTIONS,
  SORT_FIELD_LABELS,
  defaultSortDirectionForField,
  VIDEO_FILE_EXTENSIONS,
  countFilterCategorySelections,
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

/** Слоты пункта фильтра: название + чек слева, счётчик справа */
const FILTER_COUNTER_ITEM_SLOTS: ContextMenuSlot[] = ['label', 'counter'];

const FILTER_KEYWORDS_DEBOUNCE_MS = 400;
const FILTER_KEYWORDS_PLACEHOLDER = 'Ключевые слова — через пробел, все обязательны';

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
    clearFilterCategory,
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
  const descKeywordsDebounced = useDebouncedValue(descKeywords, FILTER_KEYWORDS_DEBOUNCE_MS);
  const linkKeywordsDebounced = useDebouncedValue(linkKeywords, FILTER_KEYWORDS_DEBOUNCE_MS);
  const [customWeight, setCustomWeight] = useState({ min: 0, max: 10 });
  const [customRes, setCustomRes] = useState({ minW: 0, maxW: 3840, minH: 0, maxH: 2160 });
  const [customDuration, setCustomDuration] = useState({ min: 0, max: 60 });

  useEffect(() => {
    if (openMenu !== 'description') return;
    setDescKeywords(filters.description?.keywords ?? '');
  }, [openMenu, filters.description?.keywords]);

  useEffect(() => {
    if (openMenu !== 'link') return;
    setLinkKeywords(filters.link?.keywords ?? '');
  }, [openMenu, filters.link?.keywords]);

  useEffect(() => {
    if (filters.description === null) setDescKeywords('');
  }, [filters.description]);

  useEffect(() => {
    if (filters.link === null) setLinkKeywords('');
  }, [filters.link]);

  useEffect(() => {
    if (filters.description?.mode !== 'has') return;
    const applied = filters.description.keywords ?? '';
    if (descKeywordsDebounced === applied) return;
    patchFilters({ description: { mode: 'has', keywords: descKeywordsDebounced } });
  }, [descKeywordsDebounced, filters.description?.keywords, filters.description?.mode, patchFilters]);

  useEffect(() => {
    if (filters.link?.mode !== 'has') return;
    const applied = filters.link.keywords ?? '';
    if (linkKeywordsDebounced === applied) return;
    patchFilters({ link: { mode: 'has', keywords: linkKeywordsDebounced } });
  }, [linkKeywordsDebounced, filters.link?.keywords, filters.link?.mode, patchFilters]);

  const sortRef = useRef<HTMLButtonElement>(null);
  const chipAnchorRefs = useRef<Record<string, RefObject<HTMLElement | null>>>({});
  const optionsRef = useRef<HTMLButtonElement>(null);
  const presetsRef = useRef<HTMLButtonElement>(null);

  const getChipAnchorRef = (id: GalleryFilterId): RefObject<HTMLElement | null> => {
    if (!chipAnchorRefs.current[id]) {
      chipAnchorRefs.current[id] = { current: null };
    }
    return chipAnchorRefs.current[id];
  };

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
        onSelect: () =>
          setSort({
            field,
            direction:
              sort.field === field ? sort.direction : defaultSortDirectionForField(field)
          })
      });
    }
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
    return items;
  }, [setSort, sort]);

  const buildAspectRows = (): ContextMenuRow[] => {
    const opts: { key: AspectRatioFilterValue; label: string; iconClass: string }[] = [
      { key: 'horizontal', label: 'Горизонтальное', iconClass: 'arc-icon-aspect-ratio-horizontal' },
      { key: 'vertical', label: 'Вертикальное', iconClass: 'arc-icon-aspect-ratio-vertical' },
      { key: 'square', label: 'Квадратное', iconClass: 'arc-icon-aspect-ratio-square' },
      { key: 'panoramic', label: 'Панорамное', iconClass: 'arc-icon-aspect-ratio-panoramic' }
    ];
    return opts
      .filter((o) => (stats?.aspectRatio[o.key] ?? 0) > 0)
      .map((o) => ({
        type: 'item' as const,
        key: o.key,
        label: o.label,
        iconClass: o.iconClass,
        counter: stats?.aspectRatio[o.key],
        slotOrder: ['label', 'counter', 'icon'] as const,
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
        slotOrder: FILTER_COUNTER_ITEM_SLOTS,
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
        slotOrder: FILTER_COUNTER_ITEM_SLOTS,
        selected: filters.fileExtensions.includes(ext),
        closeOnSelect: false,
        onSelect: () =>
          patchFilters({ fileExtensions: toggleInList(filters.fileExtensions, ext) })
      });
    }
    return rows;
  };

  const buildDescriptionMenu = () => {
    const keywordsEnabled = filters.description?.mode === 'has';
    return (
      <>
        <ContextMenuItem
          label="Есть"
          counter={stats?.description.has}
          slotOrder={FILTER_COUNTER_ITEM_SLOTS}
          selected={keywordsEnabled}
          onSelect={() => {
            if (filters.description?.mode === 'has') {
              patchFilters({ description: null });
              return;
            }
            patchFilters({
              description: {
                mode: 'has',
                keywords: descKeywords || filters.description?.keywords || ''
              }
            });
          }}
        />
        <ContextMenuItem
          label="Нет"
          counter={stats?.description.missing}
          slotOrder={FILTER_COUNTER_ITEM_SLOTS}
          selected={filters.description?.mode === 'missing'}
          onSelect={() => {
            if (filters.description?.mode === 'missing') {
              patchFilters({ description: null });
              return;
            }
            patchFilters({ description: { mode: 'missing' } });
          }}
        />
        <ContextMenuSeparator />
        <ContextMenuInput
          variant="textarea"
          placeholder={FILTER_KEYWORDS_PLACEHOLDER}
          value={descKeywords}
          disabled={!keywordsEnabled}
          onChange={(v) => {
            if (!keywordsEnabled) return;
            setDescKeywords(v);
          }}
        />
      </>
    );
  };

  const buildLinkMenu = () => {
    const keywordsEnabled = filters.link?.mode === 'has';
    return (
      <>
        <ContextMenuItem
          label="Есть"
          counter={stats?.link.has}
          slotOrder={FILTER_COUNTER_ITEM_SLOTS}
          selected={keywordsEnabled}
          onSelect={() => {
            if (filters.link?.mode === 'has') {
              patchFilters({ link: null });
              return;
            }
            patchFilters({
              link: { mode: 'has', keywords: linkKeywords || filters.link?.keywords || '' }
            });
          }}
        />
        <ContextMenuItem
          label="Нет"
          counter={stats?.link.missing}
          slotOrder={FILTER_COUNTER_ITEM_SLOTS}
          selected={filters.link?.mode === 'missing'}
          onSelect={() => {
            if (filters.link?.mode === 'missing') {
              patchFilters({ link: null });
              return;
            }
            patchFilters({ link: { mode: 'missing' } });
          }}
        />
        <ContextMenuSeparator />
        <ContextMenuInput
          variant="textarea"
          placeholder={FILTER_KEYWORDS_PLACEHOLDER}
          value={linkKeywords}
          disabled={!keywordsEnabled}
          onChange={(v) => {
            if (!keywordsEnabled) return;
            setLinkKeywords(v);
          }}
        />
      </>
    );
  };

  const customDateValue = useMemo(() => {
    const custom = filters.dateAdded.find((d) => d.preset === 'custom');
    if (!custom) return null;
    return { from: custom.from, to: custom.to };
  }, [filters.dateAdded]);

  const handleCustomDateChange = useCallback(
    (value: { from: string; to: string } | null) => {
      if (!value) {
        patchFilters({
          dateAdded: filters.dateAdded.filter((d) => d.preset !== 'custom')
        });
        return;
      }
      patchFilters({
        dateAdded: [
          ...filters.dateAdded.filter((d) => d.preset !== 'custom'),
          { preset: 'custom', from: value.from, to: value.to ?? value.from }
        ]
      });
    },
    [filters.dateAdded, patchFilters]
  );

  const buildDateRows = (): ContextMenuRow[] => {
    const presets: { key: DateAddedFilterValue['preset']; label: string }[] = [
      { key: 'today', label: 'Сегодня' },
      { key: 'yesterday', label: 'Вчера' },
      { key: 'week', label: 'Неделя' },
      { key: 'month', label: 'Месяц' },
      { key: 'threeMonths', label: 'Три месяца' },
      { key: 'year', label: 'Год' }
    ];
    const rows: ContextMenuRow[] = [];
    for (const p of presets) {
      rows.push({
        type: 'item',
        key: p.key,
        label: p.label,
        counter: stats?.dateAdded[p.key],
        slotOrder: FILTER_COUNTER_ITEM_SLOTS,
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
    return rows;
  };

  const buildDateMenu = () => (
    <>
      <ContextMenuSeparator />
      <div className="context-menu__slot arc-navbar-no-drag">
        <Datepicker
          size="s"
          mode="optional_range"
          value={customDateValue}
          aria-label="Дата добавления"
          onChange={handleCustomDateChange}
        />
      </div>
    </>
  );

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
      onSelect: () => {
        if (filters.fileWeight.some((w) => w.preset === 'custom')) {
          patchFilters({ fileWeight: filters.fileWeight.filter((w) => w.preset !== 'custom') });
          return;
        }
        patchFilters({
          fileWeight: [{ preset: 'custom', minMb: customWeight.min, maxMb: customWeight.max }]
        });
      }
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
      onSelect: () => {
        if (filters.resolution.some((r) => r.preset === 'custom')) {
          patchFilters({ resolution: filters.resolution.filter((r) => r.preset !== 'custom') });
          return;
        }
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
        });
      }
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
      onSelect: () => {
        if (filters.duration.some((x) => x.preset === 'custom')) {
          patchFilters({ duration: filters.duration.filter((x) => x.preset !== 'custom') });
          return;
        }
        patchFilters({
          duration: [
            { preset: 'custom', minMinutes: customDuration.min, maxMinutes: customDuration.max }
          ]
        });
      }
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
    const anchorRef = getChipAnchorRef(id);
    const open = openMenu === id;
    const meta = FILTER_CHIP_META[id];
    const selectionCount = countFilterCategorySelections(filters, id);
    const active = selectionCount > 0;

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
        children = openMenu === 'dateAdded' ? buildDateMenu() : null;
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

    const handleClearCategory = (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      clearFilterCategory(id);
      closeMenu();
    };

    return (
      <>
        {active ? (
          <div
            ref={(el) => {
              anchorRef.current = el;
            }}
            className="arc-navbar-filter-chip-group arc-navbar-no-drag"
          >
            <button
              type="button"
              className="arc-navbar-filter-chip arc-navbar-filter-chip-filter"
              aria-expanded={open}
              aria-haspopup="menu"
              onClick={() => setOpenMenu(open ? null : id)}
            >
              <span className={`btn-ds__icon ${meta.iconClass}`} aria-hidden="true" />
              <span className="btn-ds__value">{meta.label}</span>
              <span className="btn-ds__counter">{selectionCount}</span>
            </button>
            <Tooltip
              content="Очистить фильтр"
              delay={500}
              position="top"
              className="arc-navbar-filter-chip-clear-tooltip"
            >
              <button
                type="button"
                className="arc-navbar-filter-chip-clear arc-navbar-no-drag"
                aria-label="Очистить фильтр"
                onClick={handleClearCategory}
              >
                <span className="btn-ds__icon arc-icon-close" aria-hidden="true" />
              </button>
            </Tooltip>
          </div>
        ) : (
          <button
            ref={(el) => {
              anchorRef.current = el;
            }}
            type="button"
            className="btn btn-ghost btn-ds btn-m arc-navbar-filter-chip"
            aria-expanded={open}
            aria-haspopup="menu"
            onClick={() => setOpenMenu(open ? null : id)}
          >
            <span className={`btn-ds__icon ${meta.iconClass}`} aria-hidden="true" />
            <span className="btn-ds__value">{meta.label}</span>
          </button>
        )}
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
