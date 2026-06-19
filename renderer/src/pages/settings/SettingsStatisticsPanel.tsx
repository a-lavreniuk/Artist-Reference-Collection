import { useCallback, useEffect, useState } from 'react';
import {
  updateTag,
  getAllCategories,
  getNavbarMetrics,
  getTagsByCategory,
  listCardsSorted,
  deleteTag,
  type CategoryRecord,
  type TagRecord
} from '../../services/db';
import * as storage from '../../services/storageClient';
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

const TAG_LIMIT = 20;

type SummaryItem = {
  id: string;
  label: string;
  value: number;
  icon: string;
};

export default function SettingsStatisticsPanel() {
  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof getNavbarMetrics>> | null>(null);
  const [totalTags, setTotalTags] = useState(0);
  const [topTags, setTopTags] = useState<TagRecord[]>([]);
  const [lowTags, setLowTags] = useState<TagRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [diskModel, setDiskModel] = useState<DiskBarModel | null>(null);
  const [tagModal, setTagModal] = useState<TagSettingsModalState | null>(null);

  const refreshTagsData = useCallback(async () => {
    const cats = await getAllCategories();
    setCategories(cats);
    const allTags: TagRecord[] = [];
    for (const cat of cats) {
      allTags.push(...(await getTagsByCategory(cat.id)));
    }
    setTotalTags(allTags.length);
    const sorted = [...allTags].sort((a, b) => b.usageCount - a.usageCount);
    setTopTags(sorted.slice(0, TAG_LIMIT));
    setLowTags(
      sorted
        .filter((t) => t.usageCount <= 5)
        .sort((a, b) => a.usageCount - b.usageCount)
        .slice(0, TAG_LIMIT)
    );
  }, []);

  useEffect(() => {
    void (async () => {
      const m = await getNavbarMetrics();
      setMetrics(m);
      await refreshTagsData();

      if (!window.arc) {
        setDiskModel(null);
        return;
      }

      const cards = await listCardsSorted('all');
      const trashCards = await storage.storageListCards({
        offset: 0,
        limit: 1_000_000,
        libraryScope: 'trash'
      });

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
            message: pressure.title,
            variant: pressure.level === 'critical' ? 'danger' : 'warning',
            skipPrefCheck: true
          });
          sessionStorage.setItem(DISK_PRESSURE_NOTIFY_SESSION_KEY, pressure.level);
        }
      } else {
        setDiskModel(null);
      }
    })();
  }, [refreshTagsData]);

  const categoryColorById = categories.reduce<Record<string, string>>((acc, category) => {
    acc[category.id] = category.colorHex;
    return acc;
  }, {});

  const summaryStats: SummaryItem[] = [
    { id: 'total-cards', label: 'Карточек', value: metrics?.totalCards ?? 0, icon: 'sticky-note' },
    { id: 'image-count', label: 'Изображений', value: metrics?.imageCards ?? 0, icon: 'image' },
    { id: 'video-count', label: 'Видео', value: metrics?.videoCards ?? 0, icon: 'play-circle' },
    { id: 'categories-count', label: 'Категорий', value: metrics?.totalCategories ?? 0, icon: 'folder-open' },
    { id: 'tags-count', label: 'Меток', value: totalTags, icon: 'tag' },
    { id: 'collections-count', label: 'Коллекций', value: metrics?.totalCollections ?? 0, icon: 'layers' }
  ];

  return (
    <div className="arc-stats-dashboard">
      <div className="arc-stats-summary-grid">
        {summaryStats.map((item) => (
          <section key={item.id} className="arc-stats-summary-card panel">
            <StatisticsPanelHead
              icon={<span className={`arc-stat-icon arc-stat-icon--${item.icon}`} aria-hidden="true" />}
            >
              <p className="typo-p-l arc-stats-summary-card__label">{item.label}</p>
              <p className="h1 arc-stats-summary-card__value">{item.value}</p>
            </StatisticsPanelHead>
          </section>
        ))}
      </div>

      <StatisticsDiskUsagePanel model={diskModel} />

      <div className="arc-stats-tags-grid">
        <section className="arc-stats-tags-panel panel">
          <StatisticsPanelHead
            icon={
              <span
                className="arc-stat-icon arc-stat-icon--arrow-up-right arc-stat-icon--success"
                aria-hidden="true"
              />
            }
          >
            <p className="typo-p-l arc-stats-tags-panel__title">Популярные метки</p>
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
          <StatisticsPanelHead
            icon={
              <span
                className="arc-stat-icon arc-stat-icon--arrow-down-left arc-stat-icon--danger"
                aria-hidden="true"
              />
            }
          >
            <p className="typo-p-l arc-stats-tags-panel__title">Малоиспользуемые метки</p>
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
            await refreshTagsData();
          }}
          onDelete={async (tagId) => {
            await deleteTag(tagId);
            setTagModal(null);
            await refreshTagsData();
          }}
        />
      ) : null}
    </div>
  );
}
