import { useCallback, useEffect, useRef, useState } from 'react';
import {
  updateTag,
  getAllCategories,
  getTagsByCategory,
  isCategoryVisibleForLibrary,
  deleteTag,
  type CategoryRecord,
  type TagRecord
} from '../../services/db';
import { EmptyState } from '../../components/empty-state';
import { StatisticsDiskUsagePanel, StatsLibraryScopeSwitch } from '../../components/statistics';
import StatisticsPanelHead from '../../components/statistics/StatisticsPanelHead';
import TagSettingsModal, { type TagSettingsModalState } from '../../components/tags/TagSettingsModal';
import { EMPTY_STATE_COPY } from '../../content/emptyStates';
import { buildDiskBarModel, type DiskBarModel } from '../../utils/buildDiskBarModel';
import {
  DISK_PRESSURE_NOTIFY_SESSION_KEY,
  evaluateDiskSpacePressure
} from '../../utils/evaluateDiskSpacePressure';
import { showAppNotification } from '../../services/notificationService';
import { useCountUp } from '../../motion';
import type { LibraryListItem } from '../../hooks/useLibraries';

const TAG_LIMIT = 20;

type StatsScope = 'all' | string;

type StatsMetrics = {
  totalCards: number;
  imageCards: number;
  videoCards: number;
  totalCollections: number;
};

type SummaryItem = {
  id: string;
  label: string;
  value: number;
  icon: string;
};

function SummaryStatValue({ value, enabled }: { value: number; enabled: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useCountUp(ref, value, enabled);
  return (
    <p ref={ref} className="h1 arc-stats-summary-card__value">
      {enabled ? 0 : value}
    </p>
  );
}

function sortTagsForStats(allTags: TagRecord[]): { top: TagRecord[]; low: TagRecord[] } {
  const sorted = [...allTags].sort((a, b) => b.usageCount - a.usageCount);
  return {
    top: sorted.slice(0, TAG_LIMIT),
    low: sorted
      .filter((t) => t.usageCount <= 5)
      .sort((a, b) => a.usageCount - b.usageCount)
      .slice(0, TAG_LIMIT)
  };
}

export default function SettingsStatisticsPanel() {
  const [libraries, setLibraries] = useState<LibraryListItem[]>([]);
  const [statsScope, setStatsScope] = useState<StatsScope>('all');
  const [metrics, setMetrics] = useState<StatsMetrics | null>(null);
  const [totalTags, setTotalTags] = useState(0);
  const [totalCategories, setTotalCategories] = useState(0);
  const [topTags, setTopTags] = useState<TagRecord[]>([]);
  const [lowTags, setLowTags] = useState<TagRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [diskModel, setDiskModel] = useState<DiskBarModel | null>(null);
  const [tagModal, setTagModal] = useState<TagSettingsModalState | null>(null);
  const librariesRef = useRef<LibraryListItem[]>([]);

  const refreshLibraries = useCallback(async (): Promise<LibraryListItem[]> => {
    if (!window.arc?.listLibraries) {
      librariesRef.current = [];
      setLibraries([]);
      return [];
    }
    const res = await window.arc.listLibraries();
    const libs = res.libraries ?? [];
    if (libs.length < librariesRef.current.length && librariesRef.current.length > 1 && libs.length <= 1) {
      return librariesRef.current;
    }
    librariesRef.current = libs;
    setLibraries(libs);
    return libs;
  }, []);

  const refreshCatalog = useCallback(async (scope: StatsScope, tagUsage: Record<string, number>) => {
    const cats = await getAllCategories();
    const scopedCats =
      scope === 'all' ? cats : cats.filter((c) => isCategoryVisibleForLibrary(c, scope));
    setCategories(scopedCats);
    setTotalCategories(scopedCats.length);

    const allTags: TagRecord[] = [];
    for (const cat of scopedCats) {
      allTags.push(...(await getTagsByCategory(cat.id)));
    }
    for (const tag of allTags) {
      tag.usageCount = tagUsage[tag.id] ?? 0;
    }

    setTotalTags(allTags.length);
    const { top, low } = sortTagsForStats(allTags);
    setTopTags(top);
    setLowTags(low);
  }, []);

  const loadScopeStats = useCallback(
    async (scope: StatsScope) => {
      if (!window.arc?.getLibraryStatistics) {
        setMetrics(null);
        setDiskModel(null);
        await refreshCatalog(scope, {});
        return;
      }

      const res = await window.arc.getLibraryStatistics({ scope });
      if (!res.ok) {
        setMetrics(null);
        setDiskModel(null);
        await refreshCatalog(scope, {});
        return;
      }

      setMetrics({
        totalCards: res.totalCards,
        imageCards: res.imageCards,
        videoCards: res.videoCards,
        totalCollections: res.totalCollections
      });

      const nextModel = buildDiskBarModel({
        imageBytes: res.imageBytes,
        videoBytes: res.videoBytes,
        trashBytes: res.trashBytes,
        libraryFolderBytes: res.libraryFolderBytes,
        diskTotalBytes: res.diskTotalBytes,
        diskFreeBytes: res.diskFreeBytes,
        driveLabel: res.driveLabel
      });
      setDiskModel(nextModel);

      // Давление диска — только для активной / единственной / сводки «все» (общий контейнер).
      const pressure = evaluateDiskSpacePressure({
        diskTotalBytes: nextModel.diskTotalBytes,
        diskFreeBytes: nextModel.diskFreeBytes,
        libraryFolderBytes: nextModel.libraryFolderBytes
      });
      if (pressure && sessionStorage.getItem(DISK_PRESSURE_NOTIFY_SESSION_KEY) !== pressure.level) {
        showAppNotification({
          message: pressure.message,
          variant: pressure.level === 'critical' ? 'danger' : 'warning',
          skipPrefCheck: true
        });
        sessionStorage.setItem(DISK_PRESSURE_NOTIFY_SESSION_KEY, pressure.level);
      }

      await refreshCatalog(scope, res.tagUsage);
    },
    [refreshCatalog]
  );

  useEffect(() => {
    void (async () => {
      if (librariesRef.current.length === 0) await refreshLibraries();
      await loadScopeStats(statsScope);
    })();
  }, [loadScopeStats, refreshLibraries, statsScope]);

  useEffect(() => {
    void (async () => {
      const libs = await refreshLibraries();
      if (libs.length <= 1) {
        setStatsScope(libs.find((l) => l.active)?.id ?? 'all');
      } else {
        setStatsScope('all');
      }
    })();
  }, [refreshLibraries]);

  useEffect(() => {
    const onLibraryChanged = () => {
      void (async () => {
        const libs = await refreshLibraries();
        if (libs.length <= 1) {
          setStatsScope(libs.find((l) => l.active)?.id ?? 'all');
        }
        await loadScopeStats(statsScope === 'all' ? 'all' : statsScope);
      })();
    };
    window.addEventListener('arc:library-changed', onLibraryChanged);
    return () => window.removeEventListener('arc:library-changed', onLibraryChanged);
  }, [loadScopeStats, refreshLibraries, statsScope]);

  const categoryColorById = categories.reduce<Record<string, string>>((acc, category) => {
    acc[category.id] = category.colorHex;
    return acc;
  }, {});

  const summaryStats: SummaryItem[] = [
    { id: 'total-cards', label: 'Карточек', value: metrics?.totalCards ?? 0, icon: 'card' },
    { id: 'image-count', label: 'Изображений', value: metrics?.imageCards ?? 0, icon: 'image' },
    { id: 'video-count', label: 'Видео', value: metrics?.videoCards ?? 0, icon: 'play-circle' },
    { id: 'categories-count', label: 'Категорий', value: totalCategories, icon: 'folder-open' },
    { id: 'tags-count', label: 'Меток', value: totalTags, icon: 'tag' },
    { id: 'collections-count', label: 'Коллекций', value: metrics?.totalCollections ?? 0, icon: 'collection' }
  ];

  return (
    <div className="arc-stats-dashboard" data-interface-tour-anchor="statistics-main">
      <StatsLibraryScopeSwitch libraries={libraries} statsScope={statsScope} onChange={setStatsScope} />

      <div className="arc-stats-summary-grid">
        {summaryStats.map((item) => (
          <section key={item.id} className="arc-stats-summary-card panel">
            <StatisticsPanelHead
              icon={<span className={`arc-stat-icon arc-stat-icon--${item.icon}`} aria-hidden="true" />}
            >
              <p className="text-m arc-stats-summary-card__label">{item.label}</p>
              <SummaryStatValue value={item.value} enabled={metrics !== null} />
            </StatisticsPanelHead>
          </section>
        ))}
      </div>

      <StatisticsDiskUsagePanel model={diskModel} />

      <div className="arc-stats-tags-grid">
        <section className="arc-stats-tags-panel panel">
          <StatisticsPanelHead>
            <p className="text-l arc-stats-tags-panel__title">Популярные метки</p>
            <div className="arc-category-tag-cloud">
              {topTags.length === 0 ? (
                <EmptyState
                  {...EMPTY_STATE_COPY.statsPopularTagsEmpty}
                  className="arc-stats-tags-empty"
                  elevation="sunken"
                />
              ) : (
                topTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className="chip"
                    aria-label={`Редактировать метку «${tag.name}»`}
                    onClick={() => setTagModal({ mode: 'edit', tag })}
                  >
                    <span
                      className="chip-color"
                      style={{ background: categoryColorById[tag.categoryId] ?? 'var(--gray-700)' }}
                      aria-hidden="true"
                    />
                    <span>{tag.name}</span>
                    <span className="chip-count">{tag.usageCount}</span>
                  </button>
                ))
              )}
            </div>
          </StatisticsPanelHead>
        </section>

        <section className="arc-stats-tags-panel panel">
          <StatisticsPanelHead>
            <p className="text-l arc-stats-tags-panel__title">Малоиспользуемые метки</p>
            <div className="arc-category-tag-cloud">
              {lowTags.length === 0 ? (
                <EmptyState
                  {...EMPTY_STATE_COPY.statsLowTagsEmpty}
                  className="arc-stats-tags-empty"
                  elevation="sunken"
                />
              ) : (
                lowTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className="chip"
                    aria-label={`Редактировать метку «${tag.name}»`}
                    onClick={() => setTagModal({ mode: 'edit', tag })}
                  >
                    <span
                      className="chip-color"
                      style={{ background: categoryColorById[tag.categoryId] ?? 'var(--gray-700)' }}
                      aria-hidden="true"
                    />
                    <span>{tag.name}</span>
                    <span className="chip-count">{tag.usageCount}</span>
                  </button>
                ))
              )}
            </div>
          </StatisticsPanelHead>
        </section>
      </div>

      {tagModal ? (
        <TagSettingsModal
          state={tagModal}
          categories={categories}
          onClose={() => setTagModal(null)}
          onCreate={async () => Promise.resolve()}
          onSave={async (payload) => {
            await updateTag(payload.tagId, {
              name: payload.name,
              categoryId: payload.categoryId,
              description: payload.description,
              tooltipImageDataUrl: payload.tooltipImageDataUrl
            });
            setTagModal(null);
            await loadScopeStats(statsScope);
          }}
          onDelete={async (tagId) => {
            await deleteTag(tagId);
            setTagModal(null);
            await loadScopeStats(statsScope);
          }}
        />
      ) : null}
    </div>
  );
}
