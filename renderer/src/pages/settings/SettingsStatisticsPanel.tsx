import { useCallback, useEffect, useRef, useState } from 'react';
import {
  updateTag,
  getAllCategories,
  getNavbarMetrics,
  getTagsByCategory,
  isCategoryVisibleForLibrary,
  listAllCardsPaginated,
  deleteTag,
  type CategoryRecord,
  type TagRecord
} from '../../services/db';
import { StatisticsDiskUsagePanel } from '../../components/statistics';
import StatisticsPanelHead from '../../components/statistics/StatisticsPanelHead';
import TagSettingsModal, { type TagSettingsModalState } from '../../components/tags/TagSettingsModal';
import { buildDiskBarModel, type DiskBarModel } from '../../utils/buildDiskBarModel';
import { computeSplitLibraryMediaBytesFromCards } from '../../utils/computeLibraryMediaBytesFromCards';
import { computeTrashBytesFromCards } from '../../utils/computeTrashBytesFromCards';
import {
  DISK_PRESSURE_NOTIFY_SESSION_KEY,
  evaluateDiskSpacePressure
} from '../../utils/evaluateDiskSpacePressure';
import { showAppNotification } from '../../services/notificationService';
import { useCountUp } from '../../motion';
import type { LibraryListItem } from '../../hooks/useLibraries';

const TAG_LIMIT = 20;

type StatsScope = 'all' | string;

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
  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof getNavbarMetrics>> | null>(null);
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
    // Не затирать уже известный multi-list одним «укороченным» ответом (гонка repair/конфига).
    if (libs.length < librariesRef.current.length && librariesRef.current.length > 1 && libs.length <= 1) {
      return librariesRef.current;
    }
    librariesRef.current = libs;
    setLibraries(libs);
    return libs;
  }, []);

  const refreshTagsData = useCallback(async (scope: StatsScope, libs: LibraryListItem[]) => {
    const cats = await getAllCategories();
    const scopedCats =
      scope === 'all'
        ? cats
        : cats.filter((c) => isCategoryVisibleForLibrary(c, scope));
    setCategories(scopedCats);
    setTotalCategories(scopedCats.length);

    const allTags: TagRecord[] = [];
    for (const cat of scopedCats) {
      allTags.push(...(await getTagsByCategory(cat.id)));
    }

    // Per-library usage only for the active library (IPC counts active DB).
    const scopedLib = scope === 'all' ? null : libs.find((l) => l.id === scope) ?? null;
    if (scopedLib?.active && window.arc?.storageCountCardsWithTagIds) {
      await Promise.all(
        allTags.map(async (tag) => {
          tag.usageCount = await window.arc!.storageCountCardsWithTagIds([tag.id]);
        })
      );
    }

    setTotalTags(allTags.length);
    const { top, low } = sortTagsForStats(allTags);
    setTopTags(top);
    setLowTags(low);
  }, []);

  useEffect(() => {
    void (async () => {
      // Табы меняют только scope: не дергаем listLibraries/repair на каждый клик.
      const libs = librariesRef.current.length > 0 ? librariesRef.current : await refreshLibraries();
      const m = await getNavbarMetrics();
      setMetrics(m);
      await refreshTagsData(statsScope, libs);

      if (!window.arc) {
        setDiskModel(null);
        return;
      }

      const viewingActiveLibraryTab =
        libs.length <= 1 ||
        (statsScope !== 'all' && libs.find((l) => l.id === statsScope)?.active === true);

      if (!viewingActiveLibraryTab || (statsScope === 'all' && libs.length > 1)) {
        setDiskModel(null);
        return;
      }

      const cards = await listAllCardsPaginated({ libraryScope: 'all' });
      const trashCards = await listAllCardsPaginated({ libraryScope: 'trash' });

      const { imageBytes, videoBytes } = await computeSplitLibraryMediaBytesFromCards(window.arc, cards);
      const trashBytes = await computeTrashBytesFromCards(window.arc, trashCards);

      const diskStatsFn = window.arc.getLibraryDiskStats;
      if (typeof diskStatsFn !== 'function') {
        setDiskModel(null);
        return;
      }

      const diskRes = await diskStatsFn.call(window.arc);
      if (diskRes.ok) {
        const nextModel = buildDiskBarModel({
          imageBytes,
          videoBytes,
          trashBytes,
          libraryFolderBytes: diskRes.libraryFolderBytes,
          diskTotalBytes: diskRes.diskTotalBytes,
          diskFreeBytes: diskRes.diskFreeBytes,
          driveLabel: diskRes.driveLabel
        });
        setDiskModel(nextModel);

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
      } else {
        setDiskModel(null);
      }
    })();
  }, [refreshLibraries, refreshTagsData, statsScope]);

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
        await refreshTagsData(statsScope === 'all' ? 'all' : statsScope, libs);
      })();
    };
    window.addEventListener('arc:library-changed', onLibraryChanged);
    return () => window.removeEventListener('arc:library-changed', onLibraryChanged);
  }, [refreshLibraries, refreshTagsData, statsScope]);

  const categoryColorById = categories.reduce<Record<string, string>>((acc, category) => {
    acc[category.id] = category.colorHex;
    return acc;
  }, {});

  const selectedLibrary = statsScope === 'all' ? null : libraries.find((l) => l.id === statsScope) ?? null;
  const activeLibrary = libraries.find((l) => l.active) ?? null;
  /** Подробные медиа/диск — только вкладка активной библиотеки (без hot-switch). */
  const viewingActiveLibraryTab =
    selectedLibrary != null &&
    (selectedLibrary.active === true || (activeLibrary != null && selectedLibrary.id === activeLibrary.id));
  const showDetailedMedia =
    viewingActiveLibraryTab || (libraries.length <= 1 && statsScope !== 'all');
  const showAllLibrariesCardsOnly = statsScope === 'all' && libraries.length > 1;
  const showInactiveLibrarySummary =
    selectedLibrary != null && !viewingActiveLibraryTab && libraries.length > 1;
  /** Tags catalog: full on «Все», visible-only on a library tab. */
  const showTagsStats = true;

  const aggregatedCards = showAllLibrariesCardsOnly
    ? libraries.reduce((sum, lib) => sum + (lib.cardCount ?? 0), 0)
    : selectedLibrary && !selectedLibrary.active
      ? (selectedLibrary.cardCount ?? 0)
      : (metrics?.totalCards ?? 0);

  const summaryStats: SummaryItem[] = showDetailedMedia
    ? [
        { id: 'total-cards', label: 'Карточек', value: aggregatedCards, icon: 'sticky-note' },
        { id: 'image-count', label: 'Изображений', value: metrics?.imageCards ?? 0, icon: 'image' },
        { id: 'video-count', label: 'Видео', value: metrics?.videoCards ?? 0, icon: 'play-circle' },
        { id: 'categories-count', label: 'Категорий', value: totalCategories, icon: 'folder-open' },
        { id: 'tags-count', label: 'Меток', value: totalTags, icon: 'tag' },
        { id: 'collections-count', label: 'Коллекций', value: metrics?.totalCollections ?? 0, icon: 'layers' }
      ]
    : [
        { id: 'total-cards', label: 'Карточек', value: aggregatedCards, icon: 'sticky-note' },
        { id: 'categories-count', label: 'Категорий', value: totalCategories, icon: 'folder-open' },
        { id: 'tags-count', label: 'Меток', value: totalTags, icon: 'tag' }
      ];

  return (
    <div className="arc-stats-dashboard" data-interface-tour-anchor="statistics-main">
      {libraries.length > 1 ? (
        <div className="tabs arc-stats-library-tabs arc-ui-kit-scope" data-btn-size="m" role="tablist" aria-label="Библиотеки">
          <button
            type="button"
            role="tab"
            className={`tab-button${statsScope === 'all' ? ' is-active' : ''}`}
            aria-selected={statsScope === 'all'}
            onClick={() => setStatsScope('all')}
          >
            <span className="tab-button__label">Все библиотеки</span>
          </button>
          {libraries.map((lib) => (
            <button
              key={lib.id}
              type="button"
              role="tab"
              className={`tab-button${statsScope === lib.id ? ' is-active' : ''}`}
              aria-selected={statsScope === lib.id}
              onClick={() => setStatsScope(lib.id)}
            >
              <span className="tab-button__label">{lib.name}</span>
            </button>
          ))}
        </div>
      ) : null}

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

      {showAllLibrariesCardsOnly || showInactiveLibrarySummary || !showDetailedMedia ? (
        <p className="text-s hint arc-stats-library-hint">
          {showAllLibrariesCardsOnly
            ? 'Сводка по всем библиотекам: общий каталог меток и суммарный счётчик карточек. Подробная статистика медиа и диск — у активной библиотеки.'
            : showInactiveLibrarySummary
              ? 'Подробная статистика медиа и использование диска доступны для активной библиотеки. Переключите её в верхней панели. Метки ниже — видимые в выбранной библиотеке.'
              : 'Подробная статистика медиа и использование диска доступны для активной библиотеки.'}
        </p>
      ) : null}

      {showDetailedMedia ? <StatisticsDiskUsagePanel model={diskModel} /> : null}

      {showTagsStats ? (
      <div className="arc-stats-tags-grid">
        <section className="arc-stats-tags-panel panel">
          <StatisticsPanelHead>
            <p className="text-l arc-stats-tags-panel__title">Популярные метки</p>
            <div className="arc-category-tag-cloud">
              {topTags.length === 0 ? (
                <p className="hint">Нет популярных меток</p>
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
                <p className="hint">Нет малоиспользуемых меток</p>
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
      ) : null}

      {tagModal && showTagsStats ? (
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
            await refreshTagsData(statsScope, libraries);
          }}
          onDelete={async (tagId) => {
            await deleteTag(tagId);
            setTagModal(null);
            await refreshTagsData(statsScope, libraries);
          }}
        />
      ) : null}
    </div>
  );
}
