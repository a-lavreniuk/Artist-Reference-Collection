import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  mergeSubsequenceOrder,
  templateFieldLabel,
  type DetailCardTemplateV1
} from '@arc-main-shared/detailCardTemplate';
import ContextMenuHeader from '../../context-menu/ContextMenuHeader';
import ContextMenuSeparator from '../../context-menu/ContextMenuSeparator';
import { hydrateArcNavbarIcons } from '../navbarIconHydrate';
import { useFilterOptionsListMotion } from '../../../motion';
import {
  FILTER_CHIP_META,
  isUserFilterBarVisible,
  type GalleryFilterId,
  type GalleryFilterLayoutState,
  type GalleryFilterStats
} from '../../gallery/galleryFilterTypes';
import { listedUserFilterFields } from '../../gallery/userFilterFields';
import FilterOptionsMenuRow, { FilterOptionsMenuGhost } from './FilterOptionsMenuRow';
import { useFilterOptionsDrag } from './useFilterOptionsDrag';

type Props = {
  layout: GalleryFilterLayoutState;
  template: DetailCardTemplateV1;
  stats: GalleryFilterStats | null;
  hasVideo: boolean;
  onReorder: (id: GalleryFilterId, insertIndex: number) => void;
  onToggleVisibility: (id: GalleryFilterId) => void;
  onReorderUserFields: (nextTemplate: DetailCardTemplateV1) => void;
  onToggleUserFilter: (fieldId: string) => void;
};

export default function FilterOptionsMenu({
  layout,
  template,
  stats,
  hasVideo,
  onReorder,
  onToggleVisibility,
  onReorderUserFields,
  onToggleUserFilter
}: Props) {
  const systemListRef = useRef<HTMLDivElement>(null);
  const userListRef = useRef<HTMLDivElement>(null);
  const userFields = listedUserFilterFields(template, stats?.customPresence);
  const { dragState: systemDrag, startDrag: startSystemDrag } = useFilterOptionsDrag((id, insertIndex) =>
    onReorder(id as GalleryFilterId, insertIndex)
  );
  const { dragState: userDrag, startDrag: startUserDrag } = useFilterOptionsDrag((id, insertIndex) => {
    const nextVisible = [...userFields];
    const from = nextVisible.findIndex((field) => field.id === id);
    if (from < 0) return;
    const [item] = nextVisible.splice(from, 1);
    let to = insertIndex;
    if (from < to) to -= 1;
    to = Math.max(0, Math.min(nextVisible.length, to));
    nextVisible.splice(to, 0, item!);
    const fields = mergeSubsequenceOrder(
      template.fields,
      nextVisible.map((field) => field.id)
    );
    onReorderUserFields({ version: 1, fields });
  });

  useLayoutEffect(() => {
    if (systemListRef.current) void hydrateArcNavbarIcons(systemListRef.current);
    if (userListRef.current) void hydrateArcNavbarIcons(userListRef.current);
  }, [layout.order, layout.visible, userFields, systemDrag, userDrag]);

  useFilterOptionsListMotion({
    listRef: systemListRef,
    order: layout.order,
    isDragging: systemDrag != null
  });
  useFilterOptionsListMotion({
    listRef: userListRef,
    order: userFields.map((field) => field.id),
    isDragging: userDrag != null
  });

  useLayoutEffect(() => {
    const ghost = document.querySelector('.context-menu__filter-row-ghost');
    if (ghost instanceof HTMLElement) {
      void hydrateArcNavbarIcons(ghost);
    }
  }, [systemDrag, userDrag]);

  const handleToggleVisibility = (id: GalleryFilterId) => {
    if (id === 'duration' && !hasVideo && !layout.visible[id]) return;
    onToggleVisibility(id);
  };

  const renderSystemList = () => {
    const dragFrom = systemDrag ? layout.order.indexOf(systemDrag.dragId as GalleryFilterId) : -1;
    const isNoOpInsert =
      systemDrag != null &&
      dragFrom >= 0 &&
      (systemDrag.insertIndex === dragFrom || systemDrag.insertIndex === dragFrom + 1);
    const showDropEnd =
      systemDrag != null && systemDrag.insertIndex === layout.order.length && !isNoOpInsert;

    return (
      <div
        ref={systemListRef}
        className={`context-menu__filter-options-list arc-navbar-no-drag${showDropEnd ? ' is-drop-end' : ''}`}
      >
        {layout.order.map((id, rowIndex) => {
          const meta = FILTER_CHIP_META[id];
          const visible = layout.visible[id];
          const durationLocked = id === 'duration' && !hasVideo;
          const showEyeOff = !visible || durationLocked;
          const visibilityDisabled = durationLocked && !visible;
          const insertBefore =
            systemDrag != null && systemDrag.insertIndex === rowIndex && !isNoOpInsert;

          return (
            <FilterOptionsMenuRow
              key={id}
              id={id}
              label={meta.label}
              visible={visible}
              showEyeOff={showEyeOff}
              visibilityDisabled={visibilityDisabled}
              isDragging={systemDrag?.dragId === id}
              insertBefore={insertBefore}
              onToggleVisibility={(rowId) => handleToggleVisibility(rowId as GalleryFilterId)}
              onRowPointerDown={(args) => {
                if (!systemListRef.current) return;
                startSystemDrag({ ...args, listEl: systemListRef.current });
              }}
            />
          );
        })}
      </div>
    );
  };

  const renderUserList = () => {
    if (userFields.length === 0) return null;
    const dragFrom = userDrag ? userFields.findIndex((field) => field.id === userDrag.dragId) : -1;
    const isNoOpInsert =
      userDrag != null &&
      dragFrom >= 0 &&
      (userDrag.insertIndex === dragFrom || userDrag.insertIndex === dragFrom + 1);
    const showDropEnd =
      userDrag != null && userDrag.insertIndex === userFields.length && !isNoOpInsert;

    return (
      <>
        <ContextMenuHeader>Пользовательские</ContextMenuHeader>
        <div
          ref={userListRef}
          className={`context-menu__filter-options-list arc-navbar-no-drag${showDropEnd ? ' is-drop-end' : ''}`}
        >
          {userFields.map((field, rowIndex) => {
            const insertBefore =
              userDrag != null && userDrag.insertIndex === rowIndex && !isNoOpInsert;
            const visible = isUserFilterBarVisible(layout, field.id);
            return (
              <FilterOptionsMenuRow
                key={field.id}
                id={field.id}
                label={templateFieldLabel(field)}
                visible={visible}
                showEyeOff={!visible}
                visibilityDisabled={false}
                isDragging={userDrag?.dragId === field.id}
                insertBefore={insertBefore}
                onToggleVisibility={onToggleUserFilter}
                onRowPointerDown={(args) => {
                  if (!userListRef.current) return;
                  startUserDrag({ ...args, listEl: userListRef.current });
                }}
              />
            );
          })}
        </div>
      </>
    );
  };

  const activeDrag = systemDrag ?? userDrag;

  return (
    <>
      <ContextMenuHeader>Системные</ContextMenuHeader>
      {renderSystemList()}
      {userFields.length > 0 ? <ContextMenuSeparator /> : null}
      {renderUserList()}
      {activeDrag ? createPortal(<FilterOptionsMenuGhost dragState={activeDrag} />, document.body) : null}
    </>
  );
}
