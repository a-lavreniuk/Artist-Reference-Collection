import { type MutableRefObject, useCallback, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ContextMenuSeparator } from '../context-menu';
import type { CategoryRecord, TagRecord } from '../../services/db';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { bindArcTagsSidebarRowPointerDown } from '../shared/arcTagsSidebarRowDragPointer';
import { Tooltip } from '../tooltip/Tooltip';
import { TruncatedTextWithTooltip } from '../tooltip/TruncatedTextWithTooltip';
import TagCategoryDropSurface from './TagCategoryDropSurface';
import TagsCategorySidebarGhost from './TagsCategorySidebarGhost';
import TagsSidebarPickerItem from './TagsSidebarPickerItem';
import { useTagsCategoryDrag } from './useTagsCategoryDrag';

type Props = {
  categories: CategoryRecord[];
  tagsByCategory: Record<string, TagRecord[]>;
  totalTagCount: number;
  selectedCategoryId: string | null;
  draggingTagIds: ReadonlySet<string> | null;
  draggingTagIdsRef?: MutableRefObject<ReadonlySet<string> | null>;
  allTags: TagRecord[];
  onSelectAll: () => void;
  onSelectCategory: (categoryId: string) => void;
  onReorderCategory: (categoryId: string, insertIndex: number) => void;
  onTagDrop: (tagIds: string[], targetCategoryId: string) => Promise<void>;
  onAddCategory: () => void;
  onEditCategory: (categoryId: string) => void;
  onCategoryContextMenu?: (categoryId: string, event: React.MouseEvent) => void;
};

export default function TagsPageSidebar({
  categories,
  tagsByCategory,
  totalTagCount,
  selectedCategoryId,
  draggingTagIds,
  draggingTagIdsRef,
  allTags,
  onSelectAll,
  onSelectCategory,
  onReorderCategory,
  onTagDrop,
  onAddCategory,
  onEditCategory,
  onCategoryContextMenu
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const skipSelectClickRef = useRef(false);

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
  }, [categories, selectedCategoryId, dragState, draggingTagIds, totalTagCount]);

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
      data-interface-tour-anchor="tags-sidebar"
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
                draggingTagIds={draggingTagIds}
                draggingTagIdsRef={draggingTagIdsRef}
                allTags={allTags}
                onTagDrop={onTagDrop}
                className={`arc-tags-sidebar-row-drop${insertBefore ? ' is-drop-before' : ''}`}
              >
                <div
                  className={`context-menu__item arc-tags-sidebar-row${isActive ? ' is-active' : ''}${isDragging ? ' is-dragging' : ''}`}
                  data-tags-category-row={category.id}
                  role="presentation"
                  onContextMenu={(event) => {
                    if (dragState) return;
                    if (event.target instanceof Element && event.target.closest('.arc-tags-sidebar-row-edit')) {
                      return;
                    }
                    onCategoryContextMenu?.(category.id, event);
                  }}
                >
                  <div className="context-menu__item-inner arc-tags-sidebar-row-inner">
                    <button
                      type="button"
                      className="arc-tags-sidebar-row-select"
                      onPointerDown={(e) =>
                        bindArcTagsSidebarRowPointerDown({
                          e,
                          listEl: listRef.current,
                          rowSelector: '[data-tags-category-row]',
                          id: category.id,
                          label: category.name,
                          count,
                          onStartDrag: startDrag,
                          skipClickRef: skipSelectClickRef
                        })
                      }
                      onClick={() => {
                        if (skipSelectClickRef.current) {
                          skipSelectClickRef.current = false;
                          return;
                        }
                        onSelectCategory(category.id);
                      }}
                    >
                      <span className="context-menu__item-label-cluster">
                        <TruncatedTextWithTooltip
                          text={category.name}
                          className="context-menu__item-label"
                        />
                        {category.visibleInActive === false ? (
                          <Tooltip content="Скрыта в этой библиотеке" position="top" delay={500}>
                            <span
                              className="context-menu__item-icon tab-icon arc-icon-eye-off"
                              data-arc-icon-size="m"
                              aria-label="Скрыта в этой библиотеке"
                            />
                          </Tooltip>
                        ) : null}
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
                      <span
                        className="context-menu__item-icon tab-icon arc-icon-edit"
                        data-arc-icon-size="m"
                        aria-hidden="true"
                      />
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
          <button type="button" className="btn btn-outline btn-ds arc-tags-sidebar-add" onClick={onAddCategory} data-interface-tour-anchor="tags-add-category">
            <span className="btn-ds__value">Добавить категорию</span>
            <span className="btn-ds__icon arc-icon-folder-plus" aria-hidden="true" />
          </button>
        </div>
      </div>

      {dragState ? createPortal(<TagsCategorySidebarGhost dragState={dragState} />, document.body) : null}
    </aside>
  );
}
