import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import {
  ContextMenu,
  ContextMenuInput,
  type ContextMenuRow
} from '../../context-menu';
import { resolveFilterSubmenuPosition } from './filterSubmenuPosition';
import type { ContextMenuSlot } from '../../context-menu/types';
import ContextMenuHeader from '../../context-menu/ContextMenuHeader';
import ContextMenuItem from '../../context-menu/ContextMenuItem';
import ContextMenuSeparator from '../../context-menu/ContextMenuSeparator';
import { Datepicker } from '../../datepicker';
import { useGalleryFilters } from '../../gallery/GalleryFilterContext';
import { useLibrarySettings } from '../../../hooks/useLibrarySettings';
import {
  FILTER_CHIP_META,
  IMAGE_FILE_EXTENSIONS,
  VIDEO_FILE_EXTENSIONS,
  countCustomFilterSelections,
  countFilterCategorySelections,
  isCustomDateFilter,
  isCustomPresenceFilter,
  isCustomSelectFilter,
  type AspectRatioFilterValue,
  type CustomFieldFilterValue,
  type DateAddedFilterValue,
  type DurationFilterValue,
  type FileWeightFilterValue,
  type GalleryFilterId,
  type RatingFilterValue,
  type ResolutionFilterValue,
  type SavedFilterPreset,
  isUserFilterBarVisible
} from '../../gallery/galleryFilterTypes';
import { setUserFilterVisibility } from '../../gallery/galleryFilterLayout';
import {
  customFilterMenuKey,
  listedUserFilterFields,
  parseCustomFilterMenuKey,
  userFilterChipMeta
} from '../../gallery/userFilterFields';
import { templateFieldLabel, type DetailTemplateField } from '@arc-main-shared/detailCardTemplate';
import { hydrateArcNavbarIcons } from '../navbarIconHydrate';
import FilterCustomRangeSection from './FilterCustomRangeSection';
import FilterResolutionCustomSection from './FilterResolutionCustomSection';
import FilterOptionsMenu from './FilterOptionsMenu';
import FilterPresetModal from './FilterPresetModal';
import FilterPresetsMenu from './FilterPresetsMenu';
import { useFilterPresetContextMenu } from './useFilterPresetContextMenu';

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

const RATING_STAR_POSITIONS = [1, 2, 3, 4, 5] as const;

/** Figma 2174:2344 — уровень оценки в меню фильтра показан звёздами, а не текстом. */
function ratingStarsNode(value: number) {
  return (
    <span className="arc-filter-rating-stars" aria-hidden="true">
      {RATING_STAR_POSITIONS.map((star) => (
        <span
          key={star}
          className={`tab-icon ${star <= value ? 'arc-icon-star-fill' : 'arc-icon-star-stroke'}`}
          data-arc-icon-size="m"
        />
      ))}
    </span>
  );
}

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

export default function NavbarFiltersMenu() {
  const rowRef = useRef<HTMLSpanElement>(null);
  const {
    filters,
    patchFilters,
    clearFilters,
    layout,
    reorderFilter,
    toggleFilterVisibility,
    stats,
    presets,
    refreshStats,
    savePreset,
    applyPreset,
    deletePreset,
    renamePreset,
    activeCategoryCount
  } = useGalleryFilters();
  const { template, update: updateLibrarySettings } = useLibrarySettings();
  const userFilterFields = listedUserFilterFields(template, stats?.customPresence);
  const userFilterBarFields = userFilterFields.filter((field) =>
    isUserFilterBarVisible(layout, field.id)
  );

  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    if (openMenu === null) return;
    void refreshStats();
  }, [openMenu, refreshStats]);

  const [presetModal, setPresetModal] = useState<PresetModalState>(null);
  const [annotKeywords, setAnnotKeywords] = useState('');
  const annotKeywordsDebounced = useDebouncedValue(annotKeywords, FILTER_KEYWORDS_DEBOUNCE_MS);
  const [customKeywords, setCustomKeywords] = useState('');
  const customKeywordsDebounced = useDebouncedValue(customKeywords, FILTER_KEYWORDS_DEBOUNCE_MS);
  const [customWeight, setCustomWeight] = useState({ min: 0, max: 10 });
  const customWeightDebounced = useDebouncedValue(customWeight, FILTER_RANGE_DEBOUNCE_MS);
  const [customRes, setCustomRes] = useState(DEFAULT_RESOLUTION_RANGE);
  const customResDebounced = useDebouncedValue(customRes, FILTER_RANGE_DEBOUNCE_MS);
  const [customDuration, setCustomDuration] = useState({ min: 0, max: 60 });
  const customDurationDebounced = useDebouncedValue(customDuration, FILTER_RANGE_DEBOUNCE_MS);

  useEffect(() => {
    if (openMenu !== 'annotations') return;
    setAnnotKeywords(filters.annotations?.keywords ?? '');
  }, [openMenu, filters.annotations?.keywords]);

  useEffect(() => {
    if (filters.annotations === null) setAnnotKeywords('');
  }, [filters.annotations]);

  const openCustomFieldId = parseCustomFilterMenuKey(openMenu ?? '');

  const patchCustomFilter = useCallback(
    (fieldId: string, value: CustomFieldFilterValue | null) => {
      const current = filters.custom[fieldId];
      if (value == null) {
        if (!(fieldId in filters.custom)) return;
      } else if (current && JSON.stringify(current) === JSON.stringify(value)) {
        return;
      }
      const custom = { ...filters.custom };
      if (value == null) delete custom[fieldId];
      else custom[fieldId] = value;
      patchFilters({ custom });
    },
    [filters.custom, patchFilters]
  );

  useEffect(() => {
    if (!openCustomFieldId) return;
    const val = filters.custom[openCustomFieldId];
    setCustomKeywords(isCustomPresenceFilter(val) ? (val.keywords ?? '') : '');
  }, [openCustomFieldId, filters.custom]);

  useEffect(() => {
    if (!openCustomFieldId) return;
    const val = filters.custom[openCustomFieldId];
    if (!isCustomPresenceFilter(val) || val.mode !== 'has') return;
    const applied = val.keywords ?? '';
    if (customKeywordsDebounced === applied) return;
    patchCustomFilter(openCustomFieldId, { mode: 'has', keywords: customKeywordsDebounced });
  }, [customKeywordsDebounced, filters.custom, openCustomFieldId, patchCustomFilter]);

  useEffect(() => {
    if (filters.annotations?.mode !== 'has') return;
    const applied = filters.annotations.keywords ?? '';
    if (annotKeywordsDebounced === applied) return;
    patchFilters({ annotations: { mode: 'has', keywords: annotKeywordsDebounced } });
  }, [annotKeywordsDebounced, filters.annotations?.keywords, filters.annotations?.mode, patchFilters]);

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

  const filtersMainRef = useRef<HTMLButtonElement>(null);
  const scopeRef = useRef<HTMLSpanElement>(null);
  const [mainOpen, setMainOpen] = useState(false);
  const [submenuPosition, setSubmenuPosition] = useState<{ x: number; y: number } | null>(null);
  const weightRangeUserChangeRef = useRef(false);
  const resolutionRangeUserChangeRef = useRef(false);
  const durationRangeUserChangeRef = useRef(false);

  useEffect(() => {
    if (!mainOpen) return;
    void refreshStats();
  }, [mainOpen, refreshStats]);

  useLayoutEffect(() => {
    if (rowRef.current) void hydrateArcNavbarIcons(rowRef.current);
  }, [layout, filters, openMenu, mainOpen, activeCategoryCount, stats]);

  const closeMenu = useCallback(() => {
    setOpenMenu(null);
    setSubmenuPosition(null);
  }, []);

  const closeAllMenus = useCallback(() => {
    setMainOpen(false);
    closeMenu();
  }, [closeMenu]);

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

  const buildTagPresenceMenu = () => (
    <>
      <ContextMenuItem
        label="Всё"
        slotOrder={FILTER_COUNTER_ITEM_SLOTS}
        selected={filters.tagPresence === null}
        onSelect={() => patchFilters({ tagPresence: null })}
      />
      <ContextMenuItem
        label="С метками"
        counter={stats?.tagPresence.tagged}
        slotOrder={FILTER_COUNTER_ITEM_SLOTS}
        selected={filters.tagPresence === 'tagged'}
        onSelect={() => {
          if (filters.tagPresence === 'tagged') {
            patchFilters({ tagPresence: null });
            return;
          }
          patchFilters({ tagPresence: 'tagged' });
        }}
      />
      <ContextMenuItem
        label="Без меток"
        counter={stats?.tagPresence.untagged}
        slotOrder={FILTER_COUNTER_ITEM_SLOTS}
        selected={filters.tagPresence === 'untagged'}
        onSelect={() => {
          if (filters.tagPresence === 'untagged') {
            patchFilters({ tagPresence: null });
            return;
          }
          patchFilters({ tagPresence: 'untagged' });
        }}
      />
    </>
  );

  const buildPresenceMenu = (
    value: { mode: 'has' | 'missing'; keywords?: string } | null | undefined,
    counters: { has?: number; missing?: number } | undefined,
    keywords: string,
    setKeywords: (next: string) => void,
    onChange: (next: { mode: 'has' | 'missing'; keywords?: string } | null) => void
  ) => {
    const keywordsEnabled = value?.mode === 'has';
    return (
      <>
        <ContextMenuItem
          label="Есть"
          counter={counters?.has}
          slotOrder={FILTER_COUNTER_ITEM_SLOTS}
          selected={keywordsEnabled}
          onSelect={() => {
            if (value?.mode === 'has') {
              onChange(null);
              return;
            }
            onChange({
              mode: 'has',
              keywords: keywords || value?.keywords || ''
            });
          }}
        />
        <ContextMenuItem
          label="Нет"
          counter={counters?.missing}
          slotOrder={FILTER_COUNTER_ITEM_SLOTS}
          selected={value?.mode === 'missing'}
          onSelect={() => {
            if (value?.mode === 'missing') {
              onChange(null);
              return;
            }
            onChange({ mode: 'missing' });
          }}
        />
        <ContextMenuSeparator />
        <ContextMenuInput
          variant="textarea"
          placeholder={FILTER_KEYWORDS_PLACEHOLDER}
          value={keywords}
          disabled={!keywordsEnabled}
          onChange={(v) => {
            if (!keywordsEnabled) return;
            setKeywords(v);
          }}
        />
      </>
    );
  };

  const buildCustomSelectMenu = (field: DetailTemplateField) => {
    const current = filters.custom[field.id];
    const selected = isCustomSelectFilter(current) ? current.values : [];
    const counts = stats?.customSelect[field.id] ?? {};
    return (
      <>
        {(field.options ?? [])
          .filter((option) => (counts[option] ?? 0) > 0)
          .map((option) => (
            <ContextMenuItem
              key={option}
              label={option}
              counter={counts[option]}
              slotOrder={FILTER_COUNTER_ITEM_SLOTS}
              selected={selected.includes(option)}
              onSelect={() => {
                const next = toggleInList(selected, option);
                patchCustomFilter(field.id, next.length ? { values: next } : null);
              }}
            />
          ))}
      </>
    );
  };

  const buildCustomDateMenu = (field: DetailTemplateField) => {
    const current = filters.custom[field.id];
    const ranges = isCustomDateFilter(current) ? current.ranges : [];
    const presets: { key: DateAddedFilterValue['preset']; label: string }[] = [
      { key: 'today', label: 'Сегодня' },
      { key: 'yesterday', label: 'Вчера' },
      { key: 'week', label: 'Неделя' },
      { key: 'month', label: 'Месяц' },
      { key: 'threeMonths', label: 'Три месяца' },
      { key: 'year', label: 'Год' }
    ];
    const rows: ContextMenuRow[] = presets.map((p) => ({
      type: 'item' as const,
      key: p.key,
      label: p.label,
      selected: ranges.some((d) => d.preset === p.key),
      closeOnSelect: false,
      onSelect: () => {
        const has = ranges.some((d) => d.preset === p.key);
        const next = has
          ? ranges.filter((d) => d.preset !== p.key)
          : [...ranges, { preset: p.key } as DateAddedFilterValue];
        patchCustomFilter(field.id, next.length ? { ranges: next } : null);
      }
    }));
    const custom = ranges.find((d) => d.preset === 'custom');
    return {
      rows,
      children: (
        <>
          <ContextMenuSeparator />
          <ContextMenuHeader>Другой период</ContextMenuHeader>
          <div className="context-menu__slot arc-filter-menu-slot arc-ui-kit-scope arc-navbar-no-drag" data-input-size="s">
            <Datepicker
              size="s"
              mode="optional_range"
              value={custom && custom.preset === 'custom' ? { from: custom.from, to: custom.to } : null}
              aria-label="Другой период"
              onChange={(value) => {
                const withoutCustom = ranges.filter((d) => d.preset !== 'custom');
                if (!value) {
                  patchCustomFilter(field.id, withoutCustom.length ? { ranges: withoutCustom } : null);
                  return;
                }
                patchCustomFilter(field.id, {
                  ranges: [
                    ...withoutCustom,
                    { preset: 'custom', from: value.from, to: value.to ?? value.from }
                  ]
                });
              }}
            />
          </div>
        </>
      )
    };
  };

  const buildCustomFieldMenu = (field: DetailTemplateField) => {
    if (field.type === 'select' || field.type === 'multiSelect') {
      return { rows: null as ContextMenuRow[] | null, children: buildCustomSelectMenu(field), label: templateFieldLabel(field) };
    }
    if (field.type === 'date') {
      const built = buildCustomDateMenu(field);
      return { rows: built.rows, children: built.children, label: templateFieldLabel(field) };
    }
    const presence = filters.custom[field.id];
    return {
      rows: null as ContextMenuRow[] | null,
      children: buildPresenceMenu(
        isCustomPresenceFilter(presence) ? presence : null,
        stats?.customPresence[field.id],
        customKeywords,
        setCustomKeywords,
        (next) => patchCustomFilter(field.id, next)
      ),
      label: templateFieldLabel(field)
    };
  };

  const buildAnnotationsMenu = () =>
    buildPresenceMenu(
      filters.annotations,
      stats?.annotations,
      annotKeywords,
      setAnnotKeywords,
      (next) => patchFilters({ annotations: next })
    );

  const customDateValue = useMemo(() => {
    const custom = filters.dateAdded.find((d) => d.preset === 'custom');
    if (!custom) return null;
    return { from: custom.from, to: custom.to };
  }, [filters.dateAdded]);

  const handleCustomDateChange = useCallback(
    (value: { from: string; to: string } | null) => {
      if (!value) {
        if (!filters.dateAdded.some((d) => d.preset === 'custom')) return;
        patchFilters({
          dateAdded: filters.dateAdded.filter((d) => d.preset !== 'custom')
        });
        return;
      }
      const current = filters.dateAdded.find((d) => d.preset === 'custom');
      const nextTo = value.to ?? value.from;
      if (
        current &&
        current.preset === 'custom' &&
        current.from === value.from &&
        (current.to ?? current.from) === nextTo
      ) {
        return;
      }
      patchFilters({
        dateAdded: [
          ...filters.dateAdded.filter((d) => d.preset !== 'custom'),
          { preset: 'custom', from: value.from, to: nextTo }
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

  const buildRatingRows = (): ContextMenuRow[] => {
    const options: { value: RatingFilterValue['value']; label: string }[] = [
      { value: 5, label: '5 звёзд' },
      { value: 4, label: '4 звезды' },
      { value: 3, label: '3 звезды' },
      { value: 2, label: '2 звезды' },
      { value: 1, label: '1 звезда' },
      { value: 0, label: 'Без оценки' }
    ];
    return options.map((option) => ({
      type: 'item',
      key: `rating-${option.value}`,
      label: option.label,
      labelNode: ratingStarsNode(option.value),
      counter: stats?.rating[String(option.value)],
      slotOrder: FILTER_COUNTER_ITEM_SLOTS,
      selected: filters.rating.some((r) => r.value === option.value),
      closeOnSelect: false,
      onSelect: () => {
        const has = filters.rating.some((r) => r.value === option.value);
        const next = has
          ? filters.rating.filter((r) => r.value !== option.value)
          : [...filters.rating, { value: option.value }];
        patchFilters({ rating: next as RatingFilterValue[] });
      }
    }));
  };

  const visibleChips = layout.order.filter((id) => {
    if (!layout.visible[id]) return false;
    if (id === 'duration' && stats && !stats.hasVideo) return false;
    return true;
  });

  const placeFilterSubmenu = useCallback(
    (rowKey: string, menuId: string) => {
      const pos = resolveFilterSubmenuPosition(rowKey);
      if (!pos) return;
      setSubmenuPosition(pos);
      setOpenMenu(menuId);
    },
    []
  );

  const buildFilterSubmenu = (id: GalleryFilterId) => {
    const meta = FILTER_CHIP_META[id];
    let rows: ContextMenuRow[] | null = null;
    let children: React.ReactNode = null;

    switch (id) {
      case 'aspectRatio':
        rows = buildAspectRows();
        break;
      case 'fileType':
        rows = buildFileTypeRows();
        break;
      case 'tagPresence':
        children = buildTagPresenceMenu();
        break;
      case 'annotations':
        children = buildAnnotationsMenu();
        break;
      case 'dateAdded':
        rows = buildDateRows();
        children = buildDateMenu();
        break;
      case 'fileWeight':
        rows = buildWeightRows();
        children = stats ? (
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
        children = (
          <FilterResolutionCustomSection
            value={customRes}
            maxBoundW={RESOLUTION_MAX_W}
            maxBoundH={RESOLUTION_MAX_H}
            onChange={(next) => {
              resolutionRangeUserChangeRef.current = true;
              setCustomRes(next);
            }}
          />
        );
        break;
      case 'duration':
        rows = buildDurationRows();
        children = stats ? (
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
      case 'rating':
        rows = buildRatingRows();
        break;
      default:
        break;
    }

    return { rows, children, label: meta.label };
  };

  const filterMainRows = useMemo<ContextMenuRow[]>(() => {
    const items: ContextMenuRow[] = [{ type: 'header', key: 'filters-sys', label: 'Системные' }];
    for (const id of visibleChips) {
      const meta = FILTER_CHIP_META[id];
      const selectionCount = countFilterCategorySelections(filters, id);
      const active = selectionCount > 0;
      items.push({
        type: 'item',
        key: `filter-${id}`,
        label: meta.label,
        iconClass: meta.iconClass,
        counter: active ? selectionCount : undefined,
        slotOrder: ['label', 'counter', 'icon'],
        closeOnSelect: false,
        onSelect: () => placeFilterSubmenu(`filter-${id}`, id)
      });
    }
    if (userFilterBarFields.length > 0) {
      items.push({ type: 'separator', key: 'filters-sep-user' });
      items.push({ type: 'header', key: 'filters-user', label: 'Пользовательские' });
      for (const field of userFilterBarFields) {
        const menuId = customFilterMenuKey(field.id);
        const meta = userFilterChipMeta(field);
        const selectionCount = countCustomFilterSelections(filters, field.id);
        items.push({
          type: 'item',
          key: `filter-${menuId}`,
          label: meta.label,
          iconClass: meta.iconClass,
          counter: selectionCount > 0 ? selectionCount : undefined,
          slotOrder: ['label', 'counter', 'icon'],
          closeOnSelect: false,
          onSelect: () => placeFilterSubmenu(`filter-${menuId}`, menuId)
        });
      }
    }
    items.push({ type: 'separator', key: 'filters-sep-1' });
    items.push({
      type: 'item',
      key: 'filter-options',
      label: 'Настроить список',
      iconClass: 'arc-icon-adjust-position',
      closeOnSelect: false,
      onSelect: () => placeFilterSubmenu('filter-options', 'options')
    });
    items.push({
      type: 'item',
      key: 'filter-presets',
      label: 'Пресеты',
      iconClass: 'arc-icon-save',
      closeOnSelect: false,
      onSelect: () => placeFilterSubmenu('filter-presets', 'presets')
    });
    if (activeCategoryCount > 0) {
      items.push({ type: 'separator', key: 'filters-sep-2' });
      items.push({
        type: 'item',
        key: 'filter-clear',
        label: 'Очистить фильтры',
        iconClass: 'arc-icon-filter-off',
        counter: activeCategoryCount,
        slotOrder: ['label', 'counter', 'icon'],
        onSelect: () => {
          clearFilters();
          closeAllMenus();
        }
      });
    }
    return items;
  }, [
    activeCategoryCount,
    clearFilters,
    closeAllMenus,
    filters,
    placeFilterSubmenu,
    userFilterBarFields,
    visibleChips
  ]);

  const activeFilterSubmenu = useMemo(() => {
    if (!openMenu || openMenu === 'options' || openMenu === 'presets') return null;
    const customId = parseCustomFilterMenuKey(openMenu);
    if (customId) {
      const field = template.fields.find((item) => item.id === customId);
      if (!field) return null;
      return buildCustomFieldMenu(field);
    }
    return buildFilterSubmenu(openMenu as GalleryFilterId);
  }, [openMenu, filters, stats, customWeight, customRes, customDuration, layout, template, customKeywords]);

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
    closeAllMenus();
    setPresetModal({ mode: 'create' });
  };

  const openEditPresetModal = (preset: SavedFilterPreset) => {
    closeAllMenus();
    setPresetModal({ mode: 'edit', preset });
  };

  const handleApplyPreset = (preset: SavedFilterPreset) => {
    applyPreset(preset);
    closeAllMenus();
  };

  const { openPresetContextMenu, contextMenuLayer: presetContextMenuLayer } = useFilterPresetContextMenu({
    onApply: handleApplyPreset,
    onRename: openEditPresetModal,
    onDelete: async (id) => {
      deletePreset(id);
      closeAllMenus();
    }
  });

  return (
    <>
      <span
        ref={rowRef}
        className="arc-navbar-island-action arc-navbar-no-drag arc-ui-kit-scope"
        data-btn-size="m"
      >
        <button
          ref={filtersMainRef}
          type="button"
          className={`btn btn-ghost btn-ds btn-m${
            activeCategoryCount > 0 ? '' : ' btn-icon-only'
          }${mainOpen || activeCategoryCount > 0 ? ' is-active' : ''}`}
          aria-label={activeCategoryCount > 0 ? `Фильтры (${activeCategoryCount})` : 'Фильтры'}
          aria-expanded={mainOpen}
          aria-haspopup="menu"
          onClick={() => {
            setMainOpen((v) => !v);
            if (mainOpen) closeMenu();
          }}
        >
          <span className="btn-icon-only__glyph arc-icon-filter" aria-hidden="true" />
          {activeCategoryCount > 0 ? (
            <span className="btn-ds__counter">{activeCategoryCount}</span>
          ) : null}
        </button>

        <ContextMenu
          open={mainOpen}
          anchorRef={filtersMainRef}
          onClose={closeAllMenus}
          rows={filterMainRows}
          ariaLabel="Фильтры"
          noDragClassName="arc-navbar-no-drag"
        />

        {activeFilterSubmenu && submenuPosition ? (
          <ContextMenu
            open
            position={submenuPosition}
            onClose={closeMenu}
            rows={activeFilterSubmenu.rows ?? undefined}
            ariaLabel={activeFilterSubmenu.label}
            noDragClassName="arc-navbar-no-drag"
          >
            {activeFilterSubmenu.children}
          </ContextMenu>
        ) : null}

        <ContextMenu
          open={openMenu === 'options' && submenuPosition != null}
          position={submenuPosition}
          onClose={closeMenu}
          ariaLabel="Настроить список фильтров"
          noDragClassName="arc-navbar-no-drag"
        >
          <FilterOptionsMenu
            layout={layout}
            template={template}
            stats={stats}
            hasVideo={stats?.hasVideo ?? true}
            onReorder={reorderFilter}
            onToggleVisibility={toggleFilterVisibility}
            onReorderUserFields={(next) => void updateLibrarySettings({ detailCardTemplate: next })}
            onToggleUserFilter={(fieldId) => {
              void updateLibrarySettings({
                systemFilterLayout: setUserFilterVisibility(
                  layout,
                  fieldId,
                  !isUserFilterBarVisible(layout, fieldId)
                )
              });
            }}
          />
        </ContextMenu>

        <ContextMenu
          open={openMenu === 'presets' && submenuPosition != null}
          position={submenuPosition}
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
            onPresetContextMenu={openPresetContextMenu}
          />
        </ContextMenu>
      </span>

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

      {presetContextMenuLayer}
    </>
  );
}
