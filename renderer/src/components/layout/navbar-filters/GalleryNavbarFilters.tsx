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
import { useLocation } from 'react-router-dom';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { ContextMenu, ContextMenuInput, type ContextMenuRow } from '../../context-menu';
import type { ContextMenuSlot } from '../../context-menu/types';
import ContextMenuHeader from '../../context-menu/ContextMenuHeader';
import ContextMenuItem from '../../context-menu/ContextMenuItem';
import ContextMenuSeparator from '../../context-menu/ContextMenuSeparator';
import { Datepicker } from '../../datepicker';
import { Tooltip } from '../../tooltip/Tooltip';
import { useGalleryFilters } from '../../gallery/GalleryFilterContext';
import {
  FILTER_CHIP_META,
  GALLERY_ORDERABLE_SORT_FIELDS,
  IMAGE_FILE_EXTENSIONS,
  SORT_DIRECTION_OPTIONS,
  SORT_FIELD_LABELS,
  createGalleryShuffleSort,
  defaultSortDirectionForField,
  isGalleryShuffleSort,
  VIDEO_FILE_EXTENSIONS,
  countFilterCategorySelections,
  type AspectRatioFilterValue,
  type DateAddedFilterValue,
  type DurationFilterValue,
  type FileWeightFilterValue,
  type GalleryFilterId,
  type GalleryOrderableSortField,
  type ResolutionFilterValue,
  type SavedFilterPreset
} from '../../gallery/galleryFilterTypes';
import { newShuffleSeed } from '../../gallery/shuffleCardIds';
import { hydrateArcNavbarIcons } from '../navbarIconHydrate';
import FilterCustomRangeSection from './FilterCustomRangeSection';
import FilterResolutionCustomSection from './FilterResolutionCustomSection';
import FilterOptionsMenu from './FilterOptionsMenu';
import FilterPresetModal from './FilterPresetModal';
import FilterPresetsMenu from './FilterPresetsMenu';

type PresetModalState = null | { mode: 'create' } | { mode: 'edit'; preset: SavedFilterPreset };

function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Слоты пункта фильтра: название + чек слева, счётчик справа */
const FILTER_COUNTER_ITEM_SLOTS: ContextMenuSlot[] = ['label', 'counter'];

const FILTER_KEYWORDS_DEBOUNCE_MS = 400;
const FILTER_RANGE_DEBOUNCE_MS = 400;
const FILTER_KEYWORDS_PLACEHOLDER = 'Ключевые слова — через пробел, все обязательны';
const RESOLUTION_MAX_W = 3840;
const RESOLUTION_MAX_H = 2160;

function isFullRange(min: number, max: number, libraryMax: number): boolean {
  return min <= 0 && max >= libraryMax;
}

function isFullResolution(res: { minW: number; maxW: number; minH: number; maxH: number }): boolean {
  return (
    res.minW <= 0 &&
    res.maxW >= RESOLUTION_MAX_W &&
    res.minH <= 0 &&
    res.maxH >= RESOLUTION_MAX_H
  );
}

const DEFAULT_RESOLUTION_RANGE = {
  minW: 0,
  maxW: RESOLUTION_MAX_W,
  minH: 0,
  maxH: RESOLUTION_MAX_H
};

export default function GalleryNavbarFilters() {
  const location = useLocation();
  const showShuffleSort = location.pathname === '/gallery';
  const rowRef = useRef<HTMLDivElement>(null);
  const {
    filters,
    patchFilters,
    clearFilters,
    clearFilterCategory,
    sort,
    setSort,
    layout,
    reorderFilter,
    toggleFilterVisibility,
    stats,
    presets,
    savePreset,
    applyPreset,
    deletePreset,
    renamePreset,
    activeCategoryCount
  } = useGalleryFilters();

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [presetModal, setPresetModal] = useState<PresetModalState>(null);
  const [descKeywords, setDescKeywords] = useState('');
  const [linkKeywords, setLinkKeywords] = useState('');
  const descKeywordsDebounced = useDebouncedValue(descKeywords, FILTER_KEYWORDS_DEBOUNCE_MS);
  const linkKeywordsDebounced = useDebouncedValue(linkKeywords, FILTER_KEYWORDS_DEBOUNCE_MS);
  const [customWeight, setCustomWeight] = useState({ min: 0, max: 10 });
  const customWeightDebounced = useDebouncedValue(customWeight, FILTER_RANGE_DEBOUNCE_MS);
  const [customRes, setCustomRes] = useState(DEFAULT_RESOLUTION_RANGE);
  const customResDebounced = useDebouncedValue(customRes, FILTER_RANGE_DEBOUNCE_MS);
  const [customDuration, setCustomDuration] = useState({ min: 0, max: 60 });
  const customDurationDebounced = useDebouncedValue(customDuration, FILTER_RANGE_DEBOUNCE_MS);

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

  useEffect(() => {
    if (!stats?.fileWeightMeta.maxMb) return;
    const maxMb = Math.round(stats.fileWeightMeta.maxMb);
    if (!filters.fileWeight.some((w) => w.preset === 'custom')) {
      setCustomWeight({ min: 0, max: maxMb });
      return;
    }
    setCustomWeight((prev) => ({
      min: Math.min(prev.min, maxMb),
      max: Math.min(Math.max(prev.max, prev.min), maxMb)
    }));
  }, [stats?.fileWeightMeta.maxMb, filters.fileWeight]);

  useEffect(() => {
    if (!stats?.durationMeta.maxSec) return;
    const maxSec = Math.max(1, Math.round(stats.durationMeta.maxSec));
    if (!filters.duration.some((d) => d.preset === 'custom')) {
      setCustomDuration({ min: 0, max: maxSec });
      return;
    }
    setCustomDuration((prev) => ({
      min: Math.min(prev.min, maxSec),
      max: Math.min(Math.max(prev.max, prev.min), maxSec)
    }));
  }, [stats?.durationMeta.maxSec, filters.duration]);

  useEffect(() => {
    if (openMenu !== 'fileWeight' || !stats?.fileWeightMeta.maxMb) return;
    const maxMb = Math.round(stats.fileWeightMeta.maxMb);
    const custom = filters.fileWeight.find((w) => w.preset === 'custom');
    if (custom && custom.preset === 'custom') {
      setCustomWeight({
        min: Math.round(custom.minMb),
        max: Math.round(custom.maxMb)
      });
      return;
    }
    setCustomWeight({ min: 0, max: maxMb });
  }, [openMenu, filters.fileWeight, stats?.fileWeightMeta.maxMb]);

  useEffect(() => {
    if (openMenu !== 'duration' || !stats?.durationMeta.maxSec) return;
    const maxSec = Math.max(1, Math.round(stats.durationMeta.maxSec));
    const custom = filters.duration.find((d) => d.preset === 'custom');
    if (custom && custom.preset === 'custom') {
      setCustomDuration({
        min: Math.round(custom.minSeconds),
        max: Math.round(custom.maxSeconds)
      });
      return;
    }
    setCustomDuration({ min: 0, max: maxSec });
  }, [openMenu, filters.duration, stats?.durationMeta.maxSec]);

  useEffect(() => {
    if (!stats?.fileWeightMeta.maxMb) return;
    const maxMb = Math.round(stats.fileWeightMeta.maxMb);
    const { min, max } = customWeightDebounced;
    const isFull = isFullRange(min, max, maxMb);
    const hasCustom = filters.fileWeight.some((w) => w.preset === 'custom');

    if (isFull) {
      weightRangeUserChangeRef.current = false;
      if (hasCustom) {
        patchFilters({ fileWeight: filters.fileWeight.filter((w) => w.preset !== 'custom') });
      }
      return;
    }

    if (!weightRangeUserChangeRef.current && !hasCustom) return;

    const currentCustom = filters.fileWeight.find((w) => w.preset === 'custom');
    const hasPresets = filters.fileWeight.some((w) => w.preset !== 'custom');
    if (
      hasPresets ||
      !currentCustom ||
      currentCustom.minMb !== min ||
      currentCustom.maxMb !== max
    ) {
      patchFilters({ fileWeight: [{ preset: 'custom', minMb: min, maxMb: max }] });
    }
  }, [customWeightDebounced, filters.fileWeight, patchFilters, stats?.fileWeightMeta.maxMb]);

  useEffect(() => {
    if (!filters.resolution.length || !filters.resolution.some((r) => r.preset === 'custom')) {
      setCustomRes(DEFAULT_RESOLUTION_RANGE);
      resolutionRangeUserChangeRef.current = false;
    }
  }, [filters.resolution]);

  useEffect(() => {
    if (openMenu !== 'resolution') return;
    const custom = filters.resolution.find((r) => r.preset === 'custom');
    if (custom && custom.preset === 'custom') {
      setCustomRes({
        minW: custom.minWidth ?? 0,
        maxW: custom.maxWidth ?? RESOLUTION_MAX_W,
        minH: custom.minHeight ?? 0,
        maxH: custom.maxHeight ?? RESOLUTION_MAX_H
      });
      return;
    }
    setCustomRes(DEFAULT_RESOLUTION_RANGE);
  }, [openMenu, filters.resolution]);

  useEffect(() => {
    const res = customResDebounced;
    const isFull = isFullResolution(res);
    const hasCustom = filters.resolution.some((r) => r.preset === 'custom');

    if (isFull) {
      resolutionRangeUserChangeRef.current = false;
      if (hasCustom) {
        patchFilters({ resolution: filters.resolution.filter((r) => r.preset !== 'custom') });
      }
      return;
    }

    if (!resolutionRangeUserChangeRef.current && !hasCustom) return;

    const currentCustom = filters.resolution.find((r) => r.preset === 'custom');
    const hasPresets = filters.resolution.some((r) => r.preset !== 'custom');
    const nextCustom = {
      preset: 'custom' as const,
      minWidth: res.minW,
      maxWidth: res.maxW,
      minHeight: res.minH,
      maxHeight: res.maxH
    };
    if (
      hasPresets ||
      !currentCustom ||
      currentCustom.minWidth !== res.minW ||
      currentCustom.maxWidth !== res.maxW ||
      currentCustom.minHeight !== res.minH ||
      currentCustom.maxHeight !== res.maxH
    ) {
      patchFilters({ resolution: [nextCustom] });
    }
  }, [customResDebounced, filters.resolution, patchFilters]);

  useEffect(() => {
    if (!stats?.durationMeta.maxSec) return;
    const maxSec = Math.max(1, Math.round(stats.durationMeta.maxSec));
    const { min, max } = customDurationDebounced;
    const isFull = isFullRange(min, max, maxSec);
    const hasCustom = filters.duration.some((d) => d.preset === 'custom');

    if (isFull) {
      durationRangeUserChangeRef.current = false;
      if (hasCustom) {
        patchFilters({ duration: filters.duration.filter((d) => d.preset !== 'custom') });
      }
      return;
    }

    if (!durationRangeUserChangeRef.current && !hasCustom) return;

    const currentCustom = filters.duration.find((d) => d.preset === 'custom');
    const hasPresets = filters.duration.some((d) => d.preset !== 'custom');
    if (
      hasPresets ||
      !currentCustom ||
      currentCustom.minSeconds !== min ||
      currentCustom.maxSeconds !== max
    ) {
      patchFilters({ duration: [{ preset: 'custom', minSeconds: min, maxSeconds: max }] });
    }
  }, [customDurationDebounced, filters.duration, patchFilters, stats?.durationMeta.maxSec]);

  const sortRef = useRef<HTMLButtonElement>(null);
  const chipAnchorRefs = useRef<Record<string, RefObject<HTMLElement | null>>>({});
  const optionsRef = useRef<HTMLButtonElement>(null);
  const presetsRef = useRef<HTMLButtonElement>(null);
  const weightRangeUserChangeRef = useRef(false);
  const resolutionRangeUserChangeRef = useRef(false);
  const durationRangeUserChangeRef = useRef(false);

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
        onSelect: () =>
          setSort(createGalleryShuffleSort(newShuffleSeed()))
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
  }, [setSort, showShuffleSort, sort]);

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
      <ContextMenuHeader>Другой период</ContextMenuHeader>
      <div className="context-menu__slot arc-filter-menu-slot arc-ui-kit-scope arc-navbar-no-drag" data-input-size="s">
        <Datepicker
          size="s"
          mode="optional_range"
          value={customDateValue}
          aria-label="Другой период"
          onChange={handleCustomDateChange}
        />
      </div>
    </>
  );

  const buildWeightRows = (): ContextMenuRow[] => {
    const meta = stats?.fileWeightMeta;
    if (!meta) return [];
    const maxMb = Math.round(meta.maxMb);
    const rows: ContextMenuRow[] = [];
    for (const segment of meta.segments) {
      const n = stats?.fileWeight[segment.key] ?? 0;
      if (n <= 0) continue;
      rows.push({
        type: 'item',
        key: segment.key,
        label: segment.label,
        counter: n,
        slotOrder: FILTER_COUNTER_ITEM_SLOTS,
        selected: filters.fileWeight.some((w) => w.preset === segment.key),
        closeOnSelect: false,
        onSelect: () => {
          weightRangeUserChangeRef.current = false;
          setCustomWeight({ min: 0, max: maxMb });
          const preset = segment.key as Exclude<FileWeightFilterValue['preset'], 'custom'>;
          const has = filters.fileWeight.some((w) => w.preset === preset);
          const next = has
            ? filters.fileWeight.filter((w) => w.preset !== preset)
            : [...filters.fileWeight.filter((w) => w.preset !== 'custom'), { preset }];
          patchFilters({ fileWeight: next as FileWeightFilterValue[] });
        }
      });
    }
    return rows;
  };

  const buildResolutionRows = (): ContextMenuRow[] => {
    const meta = stats?.resolutionMeta;
    if (!meta) return [];
    const rows: ContextMenuRow[] = [];
    for (const segment of meta.segments) {
      const n = stats?.resolution[segment.key] ?? 0;
      if (n <= 0) continue;
      rows.push({
        type: 'item',
        key: segment.key,
        label: segment.label,
        counter: n,
        slotOrder: FILTER_COUNTER_ITEM_SLOTS,
        selected: filters.resolution.some((r) => r.preset === segment.key),
        closeOnSelect: false,
        onSelect: () => {
          resolutionRangeUserChangeRef.current = false;
          setCustomRes(DEFAULT_RESOLUTION_RANGE);
          const preset = segment.key as Exclude<ResolutionFilterValue['preset'], 'custom'>;
          const has = filters.resolution.some((r) => r.preset === preset);
          const next = has
            ? filters.resolution.filter((r) => r.preset !== preset)
            : [...filters.resolution.filter((r) => r.preset !== 'custom'), { preset }];
          patchFilters({ resolution: next as ResolutionFilterValue[] });
        }
      });
    }
    return rows;
  };

  const buildDurationRows = (): ContextMenuRow[] => {
    const meta = stats?.durationMeta;
    if (!meta) return [];
    const maxSec = Math.max(1, Math.round(meta.maxSec));
    const rows: ContextMenuRow[] = [];
    for (const segment of meta.segments) {
      const n = stats?.duration[segment.key] ?? 0;
      if (n <= 0) continue;
      rows.push({
        type: 'item',
        key: segment.key,
        label: segment.label,
        counter: n,
        slotOrder: FILTER_COUNTER_ITEM_SLOTS,
        selected: filters.duration.some((x) => x.preset === segment.key),
        closeOnSelect: false,
        onSelect: () => {
          durationRangeUserChangeRef.current = false;
          setCustomDuration({ min: 0, max: maxSec });
          const has = filters.duration.some((x) => x.preset === segment.key);
          const next = has
            ? filters.duration.filter((x) => x.preset !== segment.key)
            : [...filters.duration.filter((x) => x.preset !== 'custom'), { preset: segment.key }];
          patchFilters({ duration: next as DurationFilterValue[] });
        }
      });
    }
    return rows;
  };

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
            <FilterCustomRangeSection
              header="Другой Вес, Мб"
              headerClassName="arc-filter-custom-range__header"
              min={0}
              max={Math.round(stats.fileWeightMeta.maxMb)}
              valueMin={customWeight.min}
              valueMax={customWeight.max}
              onChange={(min, max) => {
                weightRangeUserChangeRef.current = true;
                setCustomWeight({ min, max });
              }}
              ariaLabel="Другой Вес"
            />
          ) : null;
        break;
      case 'resolution':
        rows = buildResolutionRows();
        children =
          openMenu === 'resolution' ? (
            <FilterResolutionCustomSection
              value={customRes}
              maxBoundW={RESOLUTION_MAX_W}
              maxBoundH={RESOLUTION_MAX_H}
              onChange={(next) => {
                resolutionRangeUserChangeRef.current = true;
                setCustomRes(next);
              }}
            />
          ) : null;
        break;
      case 'duration':
        rows = buildDurationRows();
        children =
          openMenu === 'duration' && stats ? (
            <FilterCustomRangeSection
              header="Другая Длительность, сек"
              headerClassName="arc-filter-custom-range__header"
              min={0}
              max={Math.max(1, Math.round(stats.durationMeta.maxSec))}
              valueMin={customDuration.min}
              valueMax={customDuration.max}
              onChange={(min, max) => {
                durationRangeUserChangeRef.current = true;
                setCustomDuration({ min, max });
              }}
              ariaLabel="Другая Длительность"
            />
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

  const editPresetNames = useMemo(() => {
    if (presetModal?.mode !== 'edit') return presetNames;
    const names = new Set(presetNames);
    names.delete(presetModal.preset.name.trim().toLowerCase());
    return names;
  }, [presetNames, presetModal]);

  const openCreatePresetModal = () => {
    setOpenMenu(null);
    setPresetModal({ mode: 'create' });
  };

  const openEditPresetModal = (preset: SavedFilterPreset) => {
    setOpenMenu(null);
    setPresetModal({ mode: 'edit', preset });
  };

  const handleApplyPreset = (preset: SavedFilterPreset) => {
    applyPreset(preset);
    setOpenMenu(null);
  };

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
            ariaLabel="Список фильтров"
            noDragClassName="arc-navbar-no-drag"
          >
            <FilterOptionsMenu
              layout={layout}
              hasVideo={stats?.hasVideo ?? true}
              onReorder={reorderFilter}
              onToggleVisibility={toggleFilterVisibility}
            />
          </ContextMenu>

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
            ariaLabel="Пресеты"
            noDragClassName="arc-navbar-no-drag"
          >
            <FilterPresetsMenu
              presets={presets}
              canSave={activeCategoryCount > 0}
              onApply={handleApplyPreset}
              onEdit={openEditPresetModal}
              onSave={openCreatePresetModal}
            />
          </ContextMenu>

          <Tooltip content="Очистить фильтры" delay={500} position="top">
            <button
              type="button"
              className="btn btn-ds btn-m"
              aria-label={`Очистить фильтры${activeCategoryCount ? ` (${activeCategoryCount})` : ''}`}
              disabled={activeCategoryCount === 0}
              onClick={clearFilters}
            >
              <span className="btn-ds__icon arc-icon-trash" aria-hidden="true" />
              {activeCategoryCount > 0 ? (
                <span className="btn-ds__counter" aria-hidden="true">
                  {activeCategoryCount}
                </span>
              ) : null}
            </button>
          </Tooltip>
        </div>
      </div>

      {presetModal?.mode === 'create' ? (
        <FilterPresetModal
          mode="create"
          existingLowerNames={presetNames}
          onClose={() => setPresetModal(null)}
          onSubmit={savePreset}
        />
      ) : null}
      {presetModal?.mode === 'edit' ? (
        <FilterPresetModal
          mode="edit"
          initialName={presetModal.preset.name}
          existingLowerNames={editPresetNames}
          onClose={() => setPresetModal(null)}
          onSubmit={(name) => renamePreset(presetModal.preset.id, name)}
          onDelete={() => deletePreset(presetModal.preset.id)}
        />
      ) : null}
    </>
  );
}
