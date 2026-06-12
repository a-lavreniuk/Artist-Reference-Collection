import { useCallback, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ContextMenuSeparator } from '../context-menu';
import type { CollectionRecord } from '../../services/db';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import CollectionsSidebarGhost from './CollectionsSidebarGhost';
import { useCollectionsDrag } from './useCollectionsDrag';

type Props = {
  collections: CollectionRecord[];
  counts: Record<string, number>;
  selectedCollectionId: string | null;
  onSelectCollection: (collectionId: string) => void;
  onReorderCollection: (collectionId: string, insertIndex: number) => void;
  onAddCollection: () => void;
  onEditCollection: (collectionId: string) => void;
};

export default function CollectionsPageSidebar({
  collections,
  counts,
  selectedCollectionId,
  onSelectCollection,
  onReorderCollection,
  onAddCollection,
  onEditCollection
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const handleReorder = useCallback(
    (id: string, insertIndex: number) => {
      void onReorderCollection(id, insertIndex);
    },
    [onReorderCollection]
  );

  const { dragState, startDrag } = useCollectionsDrag(handleReorder);

  useLayoutEffect(() => {
    if (rootRef.current) {
      void hydrateArcNavbarIcons(rootRef.current);
    }
  }, [collections, selectedCollectionId, dragState, counts]);

  useLayoutEffect(() => {
    if (!dragState) return;
    const ghost = document.querySelector('.arc-tags-sidebar-row-ghost');
    if (ghost instanceof HTMLElement) {
      void hydrateArcNavbarIcons(ghost);
    }
  }, [dragState]);

  const dragFrom = dragState ? collections.findIndex((c) => c.id === dragState.dragId) : -1;
  const isNoOpInsert =
    dragState != null &&
    dragFrom >= 0 &&
    (dragState.insertIndex === dragFrom || dragState.insertIndex === dragFrom + 1);
  const showDropEnd =
    dragState != null && dragState.insertIndex >= collections.length && !isNoOpInsert;

  return (
    <aside
      ref={rootRef}
      className="arc-collections-page-sidebar context-menu context-menu--static panel elevation-sunken arc-ui-kit-scope"
      data-elevation="sunken"
      data-typo-tone="white"
      data-btn-size="m"
      role="menu"
      aria-label="Коллекции"
    >
      <div
        ref={listRef}
        className={`arc-collections-page-sidebar__scroll context-menu__list${showDropEnd ? ' is-drop-end' : ''}`}
      >
        <div className="arc-collections-page-sidebar__pad arc-collections-page-sidebar__pad--head">
          {collections.map((collection, rowIndex) => {
            const count = counts[collection.id] ?? 0;
            const isActive = selectedCollectionId === collection.id;
            const isDragging = dragState?.dragId === collection.id;
            const insertBefore =
              dragState != null && dragState.insertIndex === rowIndex && !isNoOpInsert;

            return (
              <div
                key={collection.id}
                className={`arc-tags-sidebar-row-drop${insertBefore ? ' is-drop-before' : ''}`}
              >
                <div
                  className={`context-menu__item arc-tags-sidebar-row${isActive ? ' is-active' : ''}${isDragging ? ' is-dragging' : ''}`}
                  data-collections-row={collection.id}
                  role="presentation"
                >
                  <div className="context-menu__item-inner arc-tags-sidebar-row-inner">
                    <button
                      type="button"
                      className="arc-tags-sidebar-row-handle"
                      aria-label={`Изменить порядок «${collection.name}»`}
                      onPointerDown={(e) => {
                        if (e.button !== 0 || !listRef.current) return;
                        const rowEl = e.currentTarget.closest('[data-collections-row]');
                        if (!(rowEl instanceof HTMLElement)) return;
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        startDrag({
                          id: collection.id,
                          label: collection.name,
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
                      onClick={() => onSelectCollection(collection.id)}
                    >
                      <span className="context-menu__item-label-cluster">
                        <span className="context-menu__item-label">{collection.name}</span>
                      </span>
                      <span className="context-menu__item-counter">{count}</span>
                    </button>
                    <button
                      type="button"
                      className="arc-tags-sidebar-row-edit"
                      aria-label={`Редактировать «${collection.name}»`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onEditCollection(collection.id);
                      }}
                    >
                      <span className="btn-ds__icon arc-icon-edit" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="arc-collections-page-sidebar__foot">
        <ContextMenuSeparator />
        <div className="arc-collections-page-sidebar__pad">
          <button type="button" className="btn btn-outline btn-ds arc-tags-sidebar-add" onClick={onAddCollection}>
            <span className="btn-ds__value">Добавить коллекцию</span>
            <span className="btn-ds__icon arc-icon-plus" aria-hidden="true" />
          </button>
        </div>
      </div>

      {dragState ? createPortal(<CollectionsSidebarGhost dragState={dragState} />, document.body) : null}
    </aside>
  );
}
