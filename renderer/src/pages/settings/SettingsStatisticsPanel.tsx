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
import { formatBytes } from '../../utils/formatBytes';
import { computeSplitLibraryMediaBytesFromCards } from '../../utils/computeLibraryMediaBytesFromCards';
import TagSettingsModal, { type TagSettingsModalState } from '../../components/tags/TagSettingsModal';

export default function SettingsStatisticsPanel() {
  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof getNavbarMetrics>> | null>(null);
  const [bytesImages, setBytesImages] = useState(0);
  const [bytesVideos, setBytesVideos] = useState(0);
  const [totalTags, setTotalTags] = useState(0);
  const [topTags, setTopTags] = useState<TagRecord[]>([]);
  const [lowTags, setLowTags] = useState<TagRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
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
    setTopTags(sorted.slice(0, 10));
    setLowTags(sorted.filter((t) => t.usageCount <= 5).sort((a, b) => a.usageCount - b.usageCount).slice(0, 30));
  }, []);

  useEffect(() => {
    void (async () => {
      const m = await getNavbarMetrics();
      setMetrics(m);
      const cards = await listCardsSorted('all');
      if (window.arc) {
        const { imageBytes, videoBytes } = await computeSplitLibraryMediaBytesFromCards(window.arc, cards);
        setBytesImages(imageBytes);
        setBytesVideos(videoBytes);
      } else {
        setBytesImages(0);
        setBytesVideos(0);
      }
      await refreshTagsData();
    })();
  }, [refreshTagsData]);

  const categoryColorById = categories.reduce<Record<string, string>>((acc, category) => {
    acc[category.id] = category.colorHex;
    return acc;
  }, {});

  const totalData = bytesImages + bytesVideos;
  const summaryStats = [
    { id: 'image-count', label: 'Изображений', value: metrics?.imageCards ?? 0, icon: 'image' },
    { id: 'video-count', label: 'Видео', value: metrics?.videoCards ?? 0, icon: 'play' },
    { id: 'collections-count', label: 'Коллекций', value: metrics?.totalCollections ?? 0, icon: 'folder-open' },
    { id: 'categories-count', label: 'Категорий', value: metrics?.totalCategories ?? 0, icon: 'tags' },
    { id: 'tags-count', label: 'Меток', value: totalTags, icon: 'tag' },
    { id: 'moodboard-count', label: 'Мудборд', value: metrics?.moodboardCards ?? 0, icon: 'whiteboard' },
    { id: 'images-size', label: 'Изображений', value: formatBytes(bytesImages), icon: 'images' },
    { id: 'videos-size', label: 'Видео', value: formatBytes(bytesVideos), icon: 'file-video' },
    { id: 'total-size', label: 'Всего использовано', value: formatBytes(totalData), icon: 'hard-drive' }
  ];

  return (
    <div className="arc-settings-stack">
      <div className="arc-stats-panels-grid">
        {summaryStats.map((item) => (
          <section key={item.id} className="arc-settings-block panel elevation-sunken arc-stat-panel">
            <span className={`arc-stat-icon arc-stat-icon--${item.icon}`} aria-hidden="true" />
            <div className="arc-stat-panel__content">
              <p className="h2 arc-stat-panel__value">{item.value}</p>
              <p className="typo-p-l arc-stat-panel__label">{item.label}</p>
            </div>
          </section>
        ))}
      </div>

      <div className="arc-stats-tags-grid">
        <section className="arc-settings-block panel elevation-sunken arc-stats-tags-panel">
          <span className="arc-stat-icon arc-stat-icon--arrow-up-right arc-stat-icon--success" aria-hidden="true" />
          <h2 className="h2 arc-stats-tags-panel__title">Популярные метки</h2>
          <div className="arc-category-tag-cloud">
            {topTags.length === 0 ? (
              <p className="hint">Нет популярных меток.</p>
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
        </section>

        <section className="arc-settings-block panel elevation-sunken arc-stats-tags-panel">
          <span className="arc-stat-icon arc-stat-icon--arrow-down-left arc-stat-icon--danger" aria-hidden="true" />
          <h2 className="h2 arc-stats-tags-panel__title">Малоиспользуемые (0–5 карточек)</h2>
          <div className="arc-category-tag-cloud">
            {lowTags.length === 0 ? (
              <p className="hint">Нет непопулярных меток.</p>
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
