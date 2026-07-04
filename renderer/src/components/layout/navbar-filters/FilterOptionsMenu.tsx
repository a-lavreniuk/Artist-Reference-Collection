import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ContextMenuHeader from '../../context-menu/ContextMenuHeader';
import { hydrateArcNavbarIcons } from '../navbarIconHydrate';
import { useFilterOptionsListMotion } from '../../../motion';
import {
  FILTER_CHIP_META,
  type GalleryFilterId,
  type GalleryFilterLayoutState
} from '../../gallery/galleryFilterTypes';
import FilterOptionsMenuRow, { FilterOptionsMenuGhost } from './FilterOptionsMenuRow';
import { useFilterOptionsDrag } from './useFilterOptionsDrag';

type Props = {
  layout: GalleryFilterLayoutState;
  hasVideo: boolean;
  onReorder: (id: GalleryFilterId, insertIndex: number) => void;
  onToggleVisibility: (id: GalleryFilterId) => void;
};

export default function FilterOptionsMenu({
  layout,
  hasVideo,
  onReorder,
  onToggleVisibility
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const { dragState, startDrag } = useFilterOptionsDrag(onReorder);

  useLayoutEffect(() => {
    if (!listRef.current) return;
    void hydrateArcNavbarIcons(listRef.current);
  }, [layout.order, layout.visible, dragState]);

  useFilterOptionsListMotion({
    listRef,
    order: layout.order,
    isDragging: dragState != null
  });

  useLayoutEffect(() => {
    if (!dragState) return;
    const ghost = document.querySelector('.context-menu__filter-row-ghost');
    if (ghost instanceof HTMLElement) {
      void hydrateArcNavbarIcons(ghost);
    }
  }, [dragState]);

  const handleToggleVisibility = (id: GalleryFilterId) => {
    if (id === 'duration' && !hasVideo && !layout.visible[id]) return;
    onToggleVisibility(id);
  };

  const dragFrom = dragState ? layout.order.indexOf(dragState.dragId) : -1;
  const isNoOpInsert =
    dragState != null &&
    dragFrom >= 0 &&
    (dragState.insertIndex === dragFrom || dragState.insertIndex === dragFrom + 1);
  const showDropEnd =
    dragState != null && dragState.insertIndex === layout.order.length && !isNoOpInsert;

  return (
    <>
      <ContextMenuHeader>Список фильтров</ContextMenuHeader>
      <div
        ref={listRef}
        className={`context-menu__filter-options-list arc-navbar-no-drag${showDropEnd ? ' is-drop-end' : ''}`}
      >
        {layout.order.map((id, rowIndex) => {
          const meta = FILTER_CHIP_META[id];
          const visible = layout.visible[id];
          const durationLocked = id === 'duration' && !hasVideo;
          const showEyeOff = !visible || durationLocked;
          const visibilityDisabled = durationLocked && !visible;
          const insertBefore =
            dragState != null && dragState.insertIndex === rowIndex && !isNoOpInsert;

          return (
            <FilterOptionsMenuRow
              key={id}
              id={id}
              label={meta.label}
              visible={visible}
              showEyeOff={showEyeOff}
              visibilityDisabled={visibilityDisabled}
              isDragging={dragState?.dragId === id}
              insertBefore={insertBefore}
              onToggleVisibility={handleToggleVisibility}
              onHandlePointerDown={(args) => {
                if (!listRef.current) return;
                startDrag({ ...args, listEl: listRef.current });
              }}
            />
          );
        })}
      </div>
      {dragState
        ? createPortal(<FilterOptionsMenuGhost dragState={dragState} />, document.body)
        : null}
    </>
  );
}
