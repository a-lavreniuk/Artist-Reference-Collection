import { useCallback, useEffect, useMemo, useState } from 'react';
import CategoryPanel from '../components/tags/CategoryPanel';
import TagSettingsModal, { type TagSettingsModalState } from '../components/tags/TagSettingsModal';
import {
  ARC_CARDS_CHANGED_EVENT,
  ARC_CATEGORIES_CHANGED_EVENT,
  ARC_TAGS_CHANGED_EVENT,
  deleteCategory,
  deleteTag,
  getAllCategories,
  getTagsByCategory,
  moveCategory,
  moveTagToCategory,
  addTag,
  updateTag,
  updateCategoryColorHex,
  updateCategoryName,
  updateCategoryWeight,
  type CategoryRecord,
  type CategoryWeight,
  type TagRecord
} from '../services/db';

export default function TagsPage() {
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [tagsByCategory, setTagsByCategory] = useState<Record<string, TagRecord[]>>({});
  const [draggingTagId, setDraggingTagId] = useState<string | null>(null);
  const [tagModal, setTagModal] = useState<TagSettingsModalState | null>(null);

  const allTags = useMemo(() => Object.values(tagsByCategory).flat(), [tagsByCategory]);

  const load = useCallback(async () => {
    const cats = await getAllCategories();
    const tagLists = await Promise.all(cats.map((c) => getTagsByCategory(c.id)));
    const nextTags: Record<string, TagRecord[]> = {};
    cats.forEach((c, i) => {
      nextTags[c.id] = tagLists[i] ?? [];
    });
    setCategories(cats);
    setTagsByCategory(nextTags);
  }, []);

  useEffect(() => {
    void load();
    const onRefresh = () => void load();
    window.addEventListener(ARC_CATEGORIES_CHANGED_EVENT, onRefresh);
    window.addEventListener(ARC_TAGS_CHANGED_EVENT, onRefresh);
    window.addEventListener(ARC_CARDS_CHANGED_EVENT, onRefresh);
    window.addEventListener('storage', onRefresh);
    return () => {
      window.removeEventListener(ARC_CATEGORIES_CHANGED_EVENT, onRefresh);
      window.removeEventListener(ARC_TAGS_CHANGED_EVENT, onRefresh);
      window.removeEventListener(ARC_CARDS_CHANGED_EVENT, onRefresh);
      window.removeEventListener('storage', onRefresh);
    };
  }, [load]);

  /** Прокрутка окна во время DnD меток: колёсико и автопрокрутка у края viewport */
  useEffect(() => {
    if (!draggingTagId) return;

    const EDGE_BOTTOM = 72;
    const maxStep = 24;
    let rafId = 0;
    let edgeVy = 0;

    const step = () => {
      if (edgeVy !== 0) {
        const root = document.scrollingElement ?? document.documentElement;
        root.scrollTop += edgeVy;
      }
      if (edgeVy !== 0) {
        rafId = window.requestAnimationFrame(step);
      } else {
        rafId = 0;
      }
    };

    const onDragOverCapture = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('application/tag-id')) return;
      const h = window.innerHeight;
      const y = e.clientY;
      const edgeTop = Math.max(120, Math.min(180, Math.round(h * 0.14)));
      let next = 0;
      if (y < edgeTop) {
        next = -Math.ceil(((edgeTop - y) / edgeTop) * maxStep);
        next = Math.max(next, -maxStep);
      } else if (y > h - EDGE_BOTTOM) {
        next = Math.ceil(((y - (h - EDGE_BOTTOM)) / EDGE_BOTTOM) * maxStep);
        next = Math.min(next, maxStep);
      }
      edgeVy = next;
      if (edgeVy !== 0 && !rafId) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    const onWheelCapture = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const root = document.scrollingElement ?? document.documentElement;
      root.scrollTop += e.deltaY;
    };

    document.addEventListener('dragover', onDragOverCapture, true);
    document.addEventListener('wheel', onWheelCapture, { passive: false, capture: true });

    return () => {
      document.removeEventListener('dragover', onDragOverCapture, true);
      document.removeEventListener('wheel', onWheelCapture, true);
      edgeVy = 0;
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [draggingTagId]);

  const handleTagDragStart = (tagId: string) => {
    setDraggingTagId(tagId);
  };

  const handleTagDragEnd = () => {
    setDraggingTagId(null);
  };

  const handleTagDrop = async (tagId: string, targetCategoryId: string) => {
    try {
      await moveTagToCategory(tagId, targetCategoryId);
    } finally {
      setDraggingTagId(null);
    }
  };

  if (categories.length === 0) {
    return (
      <div className="arc-tags-outlet">
        <p className="hint">Категорий пока нет. Нажмите «Добавить категорию» в шапке.</p>
      </div>
    );
  }

  return (
    <div
      className="arc-tags-outlet"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/tag-id')) {
          e.preventDefault();
        }
      }}
      onDrop={(e) => {
        if (e.dataTransfer.types.includes('application/tag-id')) {
          e.preventDefault();
          setDraggingTagId(null);
        }
      }}
    >
      <div className="arc-category-panels">
        {categories.map((category, index) => (
          <CategoryPanel
            key={category.id}
            category={category}
            tags={tagsByCategory[category.id] ?? []}
            canMoveUp={index > 0}
            canMoveDown={index < categories.length - 1}
            onRename={(name) => updateCategoryName(category.id, name)}
            onColorHexCommit={(hex) => updateCategoryColorHex(category.id, hex)}
            onWeightChange={(weight: CategoryWeight) => updateCategoryWeight(category.id, weight)}
            onMoveUp={() => moveCategory(category.id, -1)}
            onMoveDown={() => moveCategory(category.id, 1)}
            onDelete={() => deleteCategory(category.id)}
            onAddTag={(name) => addTag(category.id, name)}
            onEditTag={(tag) => setTagModal({ mode: 'edit', tag })}
            draggingTagId={draggingTagId}
            allTags={allTags}
            onTagDragStart={handleTagDragStart}
            onTagDragEnd={handleTagDragEnd}
            onTagDrop={handleTagDrop}
          />
        ))}
      </div>
      {tagModal ? (
        <TagSettingsModal
          state={tagModal}
          categories={categories}
          onClose={() => setTagModal(null)}
          onCreate={async (payload) => {
            await addTag(payload.categoryId, payload.name, {
              description: payload.description,
              tooltipImageDataUrl: payload.tooltipImageDataUrl
            });
          }}
          onSave={async (payload) => {
            await updateTag(payload.tagId, {
              name: payload.name,
              categoryId: payload.categoryId,
              description: payload.description,
              tooltipImageDataUrl: payload.tooltipImageDataUrl
            });
          }}
          onDelete={async (tagId) => {
            await deleteTag(tagId);
          }}
        />
      ) : null}
    </div>
  );
}
