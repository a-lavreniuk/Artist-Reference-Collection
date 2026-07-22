import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { hydrateArcNavbarIcons } from '../components/layout/navbarIconHydrate';
import TagsCategorySection from '../components/tags/TagsCategorySection';
import TagsPageSearch from '../components/tags/TagsPageSearch';
import TagsPageSidebar from '../components/tags/TagsPageSidebar';
import { useTagCategoryContextMenu } from '../components/tags/useTagCategoryContextMenu';
import { useTagChipContextMenu } from '../components/tags/useTagChipContextMenu';
import { moveTagsToCategory, useTagMultiSelect } from '../components/tags/useTagMultiSelect';
import { isTagDragEvent, writeTagDragPayload } from '../components/tags/tagDragPayload';
import CategorySettingsModal, {
  type CategorySettingsModalState
} from '../components/tags/CategorySettingsModal';
import TagSettingsModal, { type TagSettingsModalState } from '../components/tags/TagSettingsModal';
import { EmptyState } from '../components/empty-state';
import { EMPTY_STATE_COPY } from '../content/emptyStates';
import {
  buildTagPickerGroups,
  filterSidebarCategories,
  normalizeSearchQuery
} from '../components/gallery/tagPickerFilter';
import {
  clampTagsSidebarWidth,
  readTagsSidebarWidth,
  writeTagsSidebarWidth
} from '../components/tags/tagsSidebarWidth';
import {
  ARC_CARDS_CHANGED_EVENT,
  ARC_CATEGORIES_CHANGED_EVENT,
  ARC_TAGS_CHANGED_EVENT,
  addCategory,
  addTag,
  deleteCategory,
  deleteTag,
  getAllCategories,
  getCategoryStats,
  getTagsByCategory,
  invalidateTagsCache,
  moveTagToCategory,
  reorderCategoryToIndex,
  updateCategory,
  updateTag,
  type CategoryRecord,
  type CategoryStats,
  type TagRecord
} from '../services/db';
import { ARC_SEARCH_QUERY_TAG } from '../search/searchUrl';

export default function TagsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [tagsByCategory, setTagsByCategory] = useState<Record<string, TagRecord[]>>({});
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<Set<string>>(() => new Set());
  const [draggingTagIds, setDraggingTagIds] = useState<ReadonlySet<string> | null>(null);
  const draggingTagIdsRef = useRef<ReadonlySet<string> | null>(null);
  const [tagModal, setTagModal] = useState<TagSettingsModalState | null>(null);
  const [categoryModal, setCategoryModal] = useState<CategorySettingsModalState | null>(null);
  const [categoryModalStats, setCategoryModalStats] = useState<CategoryStats | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => readTagsSidebarWidth());

  const splitDragRef = useRef<{ startX: number; startW: number } | null>(null);
  const sidebarWidthRef = useRef(sidebarWidth);
  const pageRef = useRef<HTMLDivElement>(null);
  sidebarWidthRef.current = sidebarWidth;

  const allTags = useMemo(() => Object.values(tagsByCategory).flat(), [tagsByCategory]);
  const searchQ = normalizeSearchQuery(searchQuery);
  const mainDropEnabled = selectedCategoryId === null;

  const load = useCallback(async () => {
    invalidateTagsCache();
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

  useEffect(() => {
    const tagId = searchParams.get('tag')?.trim();
    const categoryId = searchParams.get('category')?.trim();
    if (!tagId && !categoryId) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('tag');
    nextParams.delete('category');
    setSearchParams(nextParams, { replace: true });

    if (tagId) {
      const tag = allTags.find((t) => t.id === tagId);
      if (tag) {
        setSelectedCategoryId(tag.categoryId);
        setTagModal({ mode: 'edit', tag });
      }
      return;
    }

    if (categoryId && categories.some((c) => c.id === categoryId)) {
      setSelectedCategoryId(categoryId);
    }
  }, [allTags, categories, searchParams, setSearchParams]);

  useEffect(() => {
    const onResize = () => {
      setSidebarWidth((current) => clampTagsSidebarWidth(current));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /** Прокрутка панелей во время DnD меток */
  useEffect(() => {
    if (!draggingTagIds || draggingTagIds.size === 0) return;

    const EDGE = 72;
    const maxStep = 24;
    let rafId = 0;
    let edgeVy = 0;
    let activeScrollEl: HTMLElement | null = null;

    const findScrollPanel = (clientY: number): HTMLElement | null => {
      const root = pageRef.current;
      if (!root) return null;
      const panels = root.querySelectorAll<HTMLElement>(
        '.arc-tags-page-sidebar__scroll, .arc-tags-page-main__scroll'
      );
      for (const panel of panels) {
        const rect = panel.getBoundingClientRect();
        if (clientY >= rect.top && clientY <= rect.bottom) {
          return panel;
        }
      }
      return null;
    };

    const step = () => {
      if (edgeVy !== 0 && activeScrollEl) {
        activeScrollEl.scrollTop += edgeVy;
      }
      if (edgeVy !== 0) {
        rafId = window.requestAnimationFrame(step);
      } else {
        rafId = 0;
      }
    };

    const onDragOverCapture = (e: DragEvent) => {
      if (!e.dataTransfer || !isTagDragEvent(e.dataTransfer)) return;
      activeScrollEl = findScrollPanel(e.clientY);
      if (!activeScrollEl) {
        edgeVy = 0;
        return;
      }
      const rect = activeScrollEl.getBoundingClientRect();
      const y = e.clientY;
      const edgeTop = Math.max(48, Math.min(96, Math.round(rect.height * 0.18)));
      let next = 0;
      if (y < rect.top + edgeTop) {
        next = -Math.ceil(((rect.top + edgeTop - y) / edgeTop) * maxStep);
        next = Math.max(next, -maxStep);
      } else if (y > rect.bottom - EDGE) {
        next = Math.ceil(((y - (rect.bottom - EDGE)) / EDGE) * maxStep);
        next = Math.min(next, maxStep);
      }
      edgeVy = next;
      if (edgeVy !== 0 && !rafId) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    const onWheelCapture = (e: WheelEvent) => {
      const panel = findScrollPanel(e.clientY);
      if (!panel) return;
      e.preventDefault();
      e.stopPropagation();
      panel.scrollTop += e.deltaY;
    };

    document.addEventListener('dragover', onDragOverCapture, true);
    document.addEventListener('wheel', onWheelCapture, { passive: false, capture: true });

    return () => {
      document.removeEventListener('dragover', onDragOverCapture, true);
      document.removeEventListener('wheel', onWheelCapture, true);
      edgeVy = 0;
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [draggingTagIds]);

  const sidebarCategories = useMemo(
    () => filterSidebarCategories(categories, tagsByCategory, searchQ, selectedCategoryId),
    [categories, tagsByCategory, searchQ, selectedCategoryId]
  );

  const mainSections = useMemo(
    () => buildTagPickerGroups(categories, tagsByCategory, searchQ, selectedCategoryId),
    [categories, tagsByCategory, searchQ, selectedCategoryId]
  );

  const orderedTagIds = useMemo(
    () => mainSections.flatMap((section) => section.tags.map((tag) => tag.id)),
    [mainSections]
  );

  const tagMultiSelect = useTagMultiSelect(
    orderedTagIds,
    `${searchQ}|${selectedCategoryId ?? ''}`,
    Boolean(draggingTagIds && draggingTagIds.size > 0)
  );

  const totalTagCount = useMemo(
    () => Object.values(tagsByCategory).reduce((sum, list) => sum + list.length, 0),
    [tagsByCategory]
  );

  const hideMainPanelSearch = mainSections.length === 0 && !searchQ;

  useLayoutEffect(() => {
    if (pageRef.current) {
      void hydrateArcNavbarIcons(pageRef.current);
    }
  }, [categories.length, sidebarWidth, searchQuery, selectedCategoryId, mainSections.length, draggingTagIds]);

  const handleTagDragStart = (tagId: string, dataTransfer: DataTransfer) => {
    const ids = tagMultiSelect.resolveDragTagIds(tagId);
    draggingTagIdsRef.current = ids;
    writeTagDragPayload(dataTransfer, ids);
    setDraggingTagIds(ids);
  };

  const handleTagDragEnd = () => {
    draggingTagIdsRef.current = null;
    setDraggingTagIds(null);
  };

  const handleTagDrop = async (tagIds: string[], targetCategoryId: string) => {
    try {
      await moveTagsToCategory(tagIds, targetCategoryId, moveTagToCategory);
    } finally {
      draggingTagIdsRef.current = null;
      setDraggingTagIds(null);
      tagMultiSelect.clearSelection();
    }
  };

  const handleMoveTagsToCategory = useCallback(async (tagIds: string[], categoryId: string) => {
    await moveTagsToCategory(tagIds, categoryId, moveTagToCategory);
    tagMultiSelect.clearSelection();
  }, [tagMultiSelect.clearSelection]);

  const resolvedCategoryModal = useMemo((): CategorySettingsModalState | null => {
    if (!categoryModal) return null;
    if (categoryModal.mode === 'create') return categoryModal;
    const fresh = categories.find((c) => c.id === categoryModal.category.id);
    return fresh ? { mode: 'edit', category: fresh } : null;
  }, [categoryModal, categories]);

  useEffect(() => {
    if (categoryModal?.mode === 'edit' && !categories.some((c) => c.id === categoryModal.category.id)) {
      setCategoryModal(null);
    }
  }, [categoryModal, categories]);

  useEffect(() => {
    if (!resolvedCategoryModal || resolvedCategoryModal.mode !== 'edit') {
      setCategoryModalStats(null);
      return undefined;
    }
    let cancelled = false;
    void getCategoryStats(resolvedCategoryModal.category.id).then((stats) => {
      if (!cancelled) setCategoryModalStats(stats);
    });
    return () => {
      cancelled = true;
    };
  }, [resolvedCategoryModal]);

  const openEditCategory = useCallback(
    (categoryId: string) => {
      const cat = categories.find((c) => c.id === categoryId);
      if (cat) setCategoryModal({ mode: 'edit', category: cat });
    },
    [categories]
  );

  const resolveCategory = useCallback(
    (categoryId: string) => {
      const category = categories.find((c) => c.id === categoryId);
      return category ? { id: category.id, name: category.name } : null;
    },
    [categories]
  );

  const handleDeleteCategory = useCallback(async (categoryId: string) => {
    await deleteCategory(categoryId);
    setSelectedCategoryId((current) => (current === categoryId ? null : current));
  }, []);

  const { openCategoryContextMenu, contextMenuLayer: categoryContextMenuLayer } =
    useTagCategoryContextMenu({
      resolveCategory,
      onOpen: setSelectedCategoryId,
      onEdit: openEditCategory,
      onDelete: handleDeleteCategory
    });

  const { openTagContextMenu, contextMenuLayer: tagContextMenuLayer } = useTagChipContextMenu({
    categories,
    selectedTagIds: tagMultiSelect.selectedTagIds,
    onShowInGallery: (tagId) => {
      const next = new URLSearchParams();
      next.append(ARC_SEARCH_QUERY_TAG, tagId);
      navigate({ pathname: '/gallery', search: `?${next.toString()}` });
    },
    onEdit: (tag) => setTagModal({ mode: 'edit', tag }),
    onDelete: async (tagId) => {
      await deleteTag(tagId);
    },
    onMoveTagsToCategory: handleMoveTagsToCategory
  });

  const toggleCollapse = (categoryId: string) => {
    setCollapsedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const onSplitPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    splitDragRef.current = { startX: event.clientX, startW: sidebarWidth };
  };

  const onSplitPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!splitDragRef.current) return;
    const delta = event.clientX - splitDragRef.current.startX;
    setSidebarWidth(clampTagsSidebarWidth(splitDragRef.current.startW + delta));
  };

  const finishSplitDrag = () => {
    if (!splitDragRef.current) return;
    splitDragRef.current = null;
    writeTagsSidebarWidth(sidebarWidthRef.current);
  };

  const categoryModalNode = resolvedCategoryModal ? (
    <CategorySettingsModal
      state={resolvedCategoryModal}
      stats={categoryModalStats}
      onClose={() => setCategoryModal(null)}
      onCreate={async (payload) => {
        const created = await addCategory(payload.name, payload.colorHex, {
          weight: payload.weight,
          description: payload.description
        });
        setSelectedCategoryId(created.id);
      }}
      onSave={async (payload) => {
        await updateCategory(payload.categoryId, {
          name: payload.name,
          colorHex: payload.colorHex,
          weight: payload.weight,
          description: payload.description
        });
      }}
      onDelete={async (categoryId) => {
        await deleteCategory(categoryId);
        setSelectedCategoryId((current) => (current === categoryId ? null : current));
      }}
    />
  ) : null;

  return (
    <div
      ref={pageRef}
      className="arc-tags-outlet arc-tags-page"
      data-interface-tour-anchor="tags-page"
      style={{ ['--arc-tags-sidebar-w' as string]: `${sidebarWidth}px` }}
      onDragOver={(e) => {
        if (isTagDragEvent(e.dataTransfer)) {
          e.preventDefault();
        }
      }}
      onDrop={(e) => {
        if (isTagDragEvent(e.dataTransfer)) {
          e.preventDefault();
          handleTagDragEnd();
        }
      }}
    >
      <div className="arc-tags-page-main-row">
        <TagsPageSidebar
          categories={sidebarCategories}
          tagsByCategory={tagsByCategory}
          totalTagCount={totalTagCount}
          selectedCategoryId={selectedCategoryId}
          draggingTagIds={draggingTagIds}
          draggingTagIdsRef={draggingTagIdsRef}
          allTags={allTags}
          onSelectAll={() => setSelectedCategoryId(null)}
          onSelectCategory={setSelectedCategoryId}
          onReorderCategory={(id, insertIndex) => reorderCategoryToIndex(id, insertIndex)}
          onTagDrop={handleTagDrop}
          onAddCategory={() => setCategoryModal({ mode: 'create' })}
          onEditCategory={openEditCategory}
          onCategoryContextMenu={openCategoryContextMenu}
        />

        <button
          type="button"
          className="arc-layout-splitter"
          aria-label="Изменить ширину панелей"
          onPointerDown={onSplitPointerDown}
          onPointerMove={onSplitPointerMove}
          onPointerUp={finishSplitDrag}
          onPointerCancel={finishSplitDrag}
          onLostPointerCapture={finishSplitDrag}
        />

        <main className="arc-tags-page-main panel elevation-sunken arc-ui-kit-scope" data-elevation="sunken" data-typo-tone="white" data-input-size="m">
          {hideMainPanelSearch ? null : (
            <div className="arc-tags-page-main__fixed">
              <div className="arc-tags-page-main__inset">
                <TagsPageSearch value={searchQuery} onChange={setSearchQuery} />
              </div>
              <div className="context-menu__sep" role="separator" aria-hidden="true" />
            </div>
          )}
          <div className="arc-tags-page-main__scroll">
            {mainSections.length === 0 ? (
              searchQ ? (
                <EmptyState {...EMPTY_STATE_COPY.tagsSearchNoResults} fill />
              ) : totalTagCount === 0 ? (
                <EmptyState
                  {...EMPTY_STATE_COPY.tagsNone}
                  fill
                  onPrimaryAction={() => setCategoryModal({ mode: 'create' })}
                />
              ) : (
                <EmptyState {...EMPTY_STATE_COPY.tagsSearchNoResults} fill />
              )
            ) : (
              <div className="arc-tags-page-main__scroll-pad">
              {mainSections.map(({ cat, tags }, index) => (
                <div key={cat.id} className="arc-tags-page-section-block">
                  {index > 0 ? <div className="context-menu__sep" role="separator" aria-hidden="true" /> : null}
                  <div className="arc-tags-page-section-block__inset">
                  <TagsCategorySection
                    category={cat}
                    tags={tags}
                    collapsed={collapsedCategoryIds.has(cat.id)}
                    mainDropEnabled={mainDropEnabled}
                    draggingTagIds={draggingTagIds}
                    draggingTagIdsRef={draggingTagIdsRef}
                    allTags={allTags}
                    isTagSelected={tagMultiSelect.isSelected}
                    onToggleCollapse={() => toggleCollapse(cat.id)}
                    onAddTag={() => setTagModal({ mode: 'create', categoryId: cat.id })}
                    onEditTag={(tag) => setTagModal({ mode: 'edit', tag })}
                    onTagChipPointerDown={(tag, event) => tagMultiSelect.handleTagPointerDown(tag.id, event)}
                    onTagContextMenu={openTagContextMenu}
                    onTagDragStart={handleTagDragStart}
                    onTagDragEnd={handleTagDragEnd}
                    onTagDrop={handleTagDrop}
                    onEditCategory={() => openEditCategory(cat.id)}
                  />
                  </div>
                </div>
              ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {categoryModalNode}

      {categoryContextMenuLayer}
      {tagContextMenuLayer}

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
