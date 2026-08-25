import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ContextMenuSeparator } from '../context-menu';
import type { CollectionRecord } from '../../services/db';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { bindArcTagsSidebarRowPointerDown } from '../shared/arcTagsSidebarRowDragPointer';
import { TruncatedTextWithTooltip } from '../tooltip/TruncatedTextWithTooltip';
import CollectionsSidebarGhost from './CollectionsSidebarGhost';
import { useCollectionsDrag } from './useCollectionsDrag';
import { childSections, collectionParentId, rootCollections } from '@arc-main-shared/collectionHierarchy';

type Props = {
  collections: CollectionRecord[];
  counts: Record<string, number>;
  selectedCollectionId: string | null;
  collapsedIds: ReadonlySet<string>;
  onToggleCollapsed: (collectionId: string) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  onSelectCollection: (collectionId: string) => void;
  onReorderCollection: (collectionId: string, insertIndex: number) => void;
  onAddCollection: () => void;
  onAddSection: (parentId: string) => void;
  onEditCollection: (collectionId: string) => void;
  onCollectionContextMenu?: (collectionId: string, event: React.MouseEvent) => void;
};

export default function CollectionsPageSidebar({
  collections,
  counts,
  selectedCollectionId,
  collapsedIds,
  onToggleCollapsed,
  onCollapseAll,
  onExpandAll,
  onSelectCollection,
  onReorderCollection,
  onAddCollection,
  onAddSection,
  onEditCollection,
  onCollectionContextMenu
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const skipSelectClickRef = useRef(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleReorder = useCallback(
    (id: string, insertIndex: number) => {
      void onReorderCollection(id, insertIndex);
    },
    [onReorderCollection]
  );

  const { dragState, startDrag } = useCollectionsDrag(handleReorder);
  const roots = useMemo(() => rootCollections(collections), [collections]);
  const hasAnySections = collections.some((item) => collectionParentId(item) != null);
  const allCollapsed = roots.length > 0 && roots.every((root) => collapsedIds.has(root.id));

  useLayoutEffect(() => {
    if (rootRef.current) {
      void hydrateArcNavbarIcons(rootRef.current);
    }
  }, [collections, selectedCollectionId, dragState, counts, collapsedIds, hoveredId]);

  useLayoutEffect(() => {
    if (!dragState) return;
    const ghost = document.querySelector('.arc-tags-sidebar-row-ghost');
    if (ghost instanceof HTMLElement) {
      void hydrateArcNavbarIcons(ghost);
    }
  }, [dragState]);

  const renderRow = (
    collection: CollectionRecord,
    options: { nested?: boolean; siblingGroup: string; siblingIndex: number; siblingCount: number }
  ) => {
    const count = counts[collection.id] ?? 0;
    const isActive = selectedCollectionId === collection.id;
    const isDragging = dragState?.dragId === collection.id;
    const dragItem = dragState ? collections.find((item) => item.id === dragState.dragId) : undefined;
    const showInsertBefore =
      dragState != null &&
      dragItem != null &&
      collectionParentId(dragItem) === collectionParentId(collection) &&
      dragState.insertIndex === options.siblingIndex &&
      dragState.dragId !== collection.id;

    const children = childSections(collections, collection.id);
    const collapsed = collapsedIds.has(collection.id);
    const showChevron = children.length > 0 && !options.nested;

    return (
      <div
        key={collection.id}
        className={`arc-tags-sidebar-row-drop${showInsertBefore ? ' is-drop-before' : ''}${options.nested ? ' arc-collections-page-sidebar__row--section' : ''}`}
      >
        <div
          className={`context-menu__item arc-tags-sidebar-row${isActive ? ' is-active' : ''}${isDragging ? ' is-dragging' : ''}${options.nested ? ' arc-collections-page-sidebar__item--section' : ''}`}
          data-collections-row={collection.id}
          data-sibling-group={options.siblingGroup}
          role="presentation"
          onMouseEnter={() => setHoveredId(collection.id)}
          onMouseLeave={() => setHoveredId((current) => (current === collection.id ? null : current))}
          onContextMenu={(event) => {
            if (dragState) return;
            if (event.target instanceof Element && event.target.closest('.arc-tags-sidebar-row-edit')) {
              return;
            }
            onCollectionContextMenu?.(collection.id, event);
          }}
        >
          <div className="context-menu__item-inner arc-tags-sidebar-row-inner">
            {showChevron ? (
              <button
                type="button"
                className="arc-collections-page-sidebar__chevron"
                aria-label={collapsed ? 'Развернуть разделы' : 'Свернуть разделы'}
                aria-expanded={!collapsed}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleCollapsed(collection.id);
                }}
              >
                <span
                  className={`context-menu__item-icon tab-icon arc-icon-chevron ${collapsed ? 'arc-chevron-point-right' : 'arc-chevron-point-down'}`}
                  data-arc-icon-size="s"
                  aria-hidden="true"
                />
              </button>
            ) : options.nested ? (
              <span className="arc-collections-page-sidebar__nest-mark" aria-hidden="true" />
            ) : (
              <span className="arc-collections-page-sidebar__chevron-spacer" aria-hidden="true" />
            )}
            <button
              type="button"
              className="arc-tags-sidebar-row-select"
              onPointerDown={(e) =>
                bindArcTagsSidebarRowPointerDown({
                  e,
                  listEl: listRef.current,
                  rowSelector: '[data-collections-row]',
                  id: collection.id,
                  label: collection.name,
                  count,
                  onStartDrag: (args) =>
                    startDrag({
                      ...args,
                      siblingGroup: options.siblingGroup
                    }),
                  skipClickRef: skipSelectClickRef
                })
              }
              onClick={() => {
                if (skipSelectClickRef.current) {
                  skipSelectClickRef.current = false;
                  return;
                }
                onSelectCollection(collection.id);
              }}
            >
              <span className="context-menu__item-label-cluster">
                <TruncatedTextWithTooltip
                  text={collection.name}
                  className="context-menu__item-label"
                />
              </span>
              <span className="context-menu__item-counter">{count}</span>
            </button>
            {!options.nested ? (
              <button
                type="button"
                className={`arc-collections-page-sidebar__add-section${hoveredId === collection.id ? ' is-visible' : ''}`}
                aria-label={`Добавить раздел в «${collection.name}»`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAddSection(collection.id);
                }}
              >
                <span
                  className="context-menu__item-icon tab-icon arc-icon-plus"
                  data-arc-icon-size="s"
                  aria-hidden="true"
                />
              </button>
            ) : null}
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
              <span
                className="context-menu__item-icon tab-icon arc-icon-edit"
                data-arc-icon-size="m"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
        {!options.nested && children.length > 0 && !collapsed ? (
          <div className="arc-collections-page-sidebar__children">
            {children.map((section, index) =>
              renderRow(section, {
                nested: true,
                siblingGroup: collection.id,
                siblingIndex: index,
                siblingCount: children.length
              })
            )}
          </div>
        ) : null}
      </div>
    );
  };

  const rootDropEnd =
    dragState != null &&
    collections.find((item) => item.id === dragState.dragId) != null &&
    collectionParentId(collections.find((item) => item.id === dragState.dragId)!) == null &&
    dragState.insertIndex >= roots.length;

  return (
    <aside
      ref={rootRef}
      className="arc-collections-page-sidebar context-menu context-menu--static panel elevation-sunken arc-ui-kit-scope"
      data-elevation="sunken"
      data-typo-tone="white"
      data-btn-size="m"
      data-interface-tour-anchor="collections-sidebar"
      role="menu"
      aria-label="Коллекции"
    >
      <div
        ref={listRef}
        className={`arc-collections-page-sidebar__scroll context-menu__list${rootDropEnd ? ' is-drop-end' : ''}`}
      >
        <div className="arc-collections-page-sidebar__pad">
          {roots.map((collection, index) =>
            renderRow(collection, {
              siblingGroup: 'root',
              siblingIndex: index,
              siblingCount: roots.length
            })
          )}
        </div>
      </div>

      <div className="arc-collections-page-sidebar__foot">
        <ContextMenuSeparator />
        <div className="arc-collections-page-sidebar__pad arc-collections-page-sidebar__foot-actions">
          {hasAnySections ? (
            <button
              type="button"
              className="btn btn-ghost btn-ds arc-collections-page-sidebar__collapse-all"
              onClick={allCollapsed ? onExpandAll : onCollapseAll}
            >
              <span className="btn-ds__value">{allCollapsed ? 'Развернуть все' : 'Свернуть все'}</span>
            </button>
          ) : null}
          <button type="button" className="btn btn-outline btn-ds arc-tags-sidebar-add" onClick={onAddCollection}>
            <span className="btn-ds__value">Добавить коллекцию</span>
            <span className="btn-ds__icon arc-icon-folder-plus" aria-hidden="true" />
          </button>
        </div>
      </div>

      {dragState ? createPortal(<CollectionsSidebarGhost dragState={dragState} />, document.body) : null}
    </aside>
  );
}
