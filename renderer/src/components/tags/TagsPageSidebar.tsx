import { useCallback, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ContextMenuSeparator } from '../context-menu';
import type { CategoryRecord, TagRecord } from '../../services/db';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import TagCategoryDropSurface from './TagCategoryDropSurface';
import TagsCategorySidebarGhost from './TagsCategorySidebarGhost';
import TagsSidebarPickerItem from './TagsSidebarPickerItem';
import { useTagsCategoryDrag } from './useTagsCategoryDrag';

type Props = {
  categories: CategoryRecord[];
  tagsByCategory: Record<string, TagRecord[]>;
  totalTagCount: number;
  selectedCategoryId: string | null;
  draggingTagId: string | null;
  allTags: TagRecord[];
  onSelectAll: () => void;
  onSelectCategory: (categoryId: string) => void;
  onReorderCategory: (categoryId: string, insertIndex: number) => void;
  onTagDrop: (tagId: string, targetCategoryId: string) => Promise<void>;
  onAddCategory: () => void;
  onEditCategory: (categoryId: string) => void;
};

export default function TagsPageSidebar({
  categories,
  tagsByCategory,
  totalTagCount,
  selectedCategoryId,
  draggingTagId,
  allTags,
  onSelectAll,
  onSelectCategory,
  onReorderCategory,
  onTagDrop,
  onAddCategory,
  onEditCategory
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const handleReorder = useCallback(
    (id: string, insertIndex: number) => {
      void onReorderCategory(id, insertIndex);
    },
    [onReorderCategory]
  );

  const { dragState, startDrag } = useTagsCategoryDrag(handleReorder);

  useLayoutEffect(() => {
    if (rootRef.current) {
      void hydrateArcNavbarIcons(rootRef.current);
    }
  }, [categories, selectedCategoryId, dragState, draggingTagId, totalTagCount]);

  useLayoutEffect(() => {
    if (!dragState) return;
    const ghost = document.querySelector('.arc-tags-sidebar-row-ghost');
    if (ghost instanceof HTMLElement) {
      void hydrateArcNavbarIcons(ghost);
    }
  }, [dragState]);

  const dragFrom = dragState ? categories.findIndex((c) => c.id === dragState.dragId) : -1;
  const isNoOpInsert =
    dragState != null &&
    dragFrom >= 0 &&
    (dragState.insertIndex === dragFrom || dragState.insertIndex === dragFrom + 1);
  const showDropEnd =
    dragState != null && dragState.insertIndex >= categories.length && !isNoOpInsert;

  return (
    <aside
      ref={rootRef}
      className="arc-tags-page-sidebar context-menu context-menu--static panel elevation-sunken arc-ui-kit-scope"
      data-elevation="sunken"
      data-typo-tone="white"
      data-btn-size="m"
      role="menu"
      aria-label="Категории"
    >
      <div className="arc-tags-page-sidebar__head">
        <div className="arc-tags-page-sidebar__pad">
          <TagsSidebarPickerItem
            label="Все категории"
            count={totalTagCount}
            active={selectedCategoryId === null}
            onSelect={onSelectAll}
          />
        </div>
        <ContextMenuSeparator />
        <div className="arc-tags-page-sidebar__pad">
          <p className="context-menu__header">Категории</p>
        </div>
      </div>

      <div
        ref={listRef}
        className={`arc-tags-page-sidebar__scroll context-menu__list${showDropEnd ? ' is-drop-end' : ''}`}
      >
        <div className="arc-tags-page-sidebar__pad">
          {categories.map((category, rowIndex) => {
            const count = (tagsByCategory[category.id] ?? []).length;
            const isActive = selectedCategoryId === category.id;
            const isDragging = dragState?.dragId === category.id;
            const insertBefore =
              dragState != null && dragState.insertIndex === rowIndex && !isNoOpInsert;

            return (
              <TagCategoryDropSurface
                key={category.id}
                categoryId={category.id}
                draggingTagId={draggingTagId}
                allTags={allTags}
                onTagDrop={onTagDrop}
                className={`arc-tags-sidebar-row-drop${insertBefore ? ' is-drop-before' : ''}`}
              >
                <div
                  className={`context-menu__item arc-tags-sidebar-row${isActive ? ' is-active' : ''}${isDragging ? ' is-dragging' : ''}`}
                  data-tags-category-row={category.id}
                  role="presentation"
                >
                  <div className="context-menu__item-inner arc-tags-sidebar-row-inner">
                    <button
                      type="button"
                      className="arc-tags-sidebar-row-handle"
                      aria-label={`Изменить порядок «${category.name}»`}
                      onPointerDown={(e) => {
                        if (e.button !== 0 || !listRef.current) return;
                        const rowEl = e.currentTarget.closest('[data-tags-category-row]');
                        if (!(rowEl instanceof HTMLElement)) return;
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        startDrag({
                          id: category.id,
                          label: category.name,
                          count,
                          handleEl: e.currentTarget,
                          rowEl,
                          listEl: listRef.current
                        });
                      }}
                    >
                      <span
                        className="context-menu__item-icon tab-icon arc-icon-chevrons-up-down"
                        data-arc-icon-size="m"
                        aria-hidden="true"
                      />
                    </button>
                    <button
                      type="button"
                      className="arc-tags-sidebar-row-select"
                      onClick={() => onSelectCategory(category.id)}
                    >
                      <span className="context-menu__item-label-cluster">
                        <span className="context-menu__item-label">{category.name}</span>
                      </span>
                      <span className="context-menu__item-counter">{count}</span>
                    </button>
                    <button
                      type="button"
                      className="arc-tags-sidebar-row-edit"
                      aria-label={`Редактировать «${category.name}»`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onEditCategory(category.id);
                      }}
                    >
                      <span className="btn-ds__icon arc-icon-edit" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </TagCategoryDropSurface>
            );
          })}
        </div>
      </div>

      <div className="arc-tags-page-sidebar__foot">
        <ContextMenuSeparator />
        <div className="arc-tags-page-sidebar__pad">
          <button type="button" className="btn btn-outline btn-ds arc-tags-sidebar-add" onClick={onAddCategory}>
            <span className="btn-ds__value">Добавить категорию</span>
            <span className="btn-ds__icon arc-icon-plus" aria-hidden="true" />
          </button>
        </div>
      </div>

      {dragState ? createPortal(<TagsCategorySidebarGhost dragState={dragState} />, document.body) : null}
    </aside>
  );
}
