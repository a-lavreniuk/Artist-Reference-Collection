import { type MutableRefObject, type ReactNode, useState } from 'react';
import type { TagRecord } from '../../services/db';
import { isTagDragEvent, readTagDragIds } from './tagDragPayload';

type Props = {
  categoryId: string;
  draggingTagIds: ReadonlySet<string> | null;
  draggingTagIdsRef?: MutableRefObject<ReadonlySet<string> | null>;
  allTags: TagRecord[];
  onTagDrop: (tagIds: string[], targetCategoryId: string) => void | Promise<void>;
  className?: string;
  children: ReactNode;
};

/**
 * Зона сброса метки в категорию (HTML5 DnD). Поведение согласовано с CategorySection.
 */
export default function TagCategoryDropSurface({
  categoryId,
  draggingTagIds,
  draggingTagIdsRef,
  allTags,
  onTagDrop,
  className = '',
  children
}: Props) {
  const [isTagDragOver, setIsTagDragOver] = useState(false);
  const [activeDragTagId, setActiveDragTagId] = useState<string | null>(null);

  const resolveDraggingTagIds = (): ReadonlySet<string> | null => {
    const fromRef = draggingTagIdsRef?.current;
    if (fromRef && fromRef.size > 0) return fromRef;
    return draggingTagIds;
  };

  const handleTagDragOver = (e: React.DragEvent) => {
    if (!isTagDragEvent(e.dataTransfer)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const activeIds = resolveDraggingTagIds();
    if (!activeIds || activeIds.size === 0) {
      e.dataTransfer.dropEffect = 'none';
      setIsTagDragOver(false);
      setActiveDragTagId(null);
      return;
    }

    const movable = [...activeIds].some((tagId) => {
      const tag = allTags.find((t) => t.id === tagId);
      return tag && tag.categoryId !== categoryId;
    });

    if (movable) {
      e.dataTransfer.dropEffect = 'move';
      setIsTagDragOver(true);
      setActiveDragTagId([...activeIds][0] ?? null);
    } else {
      e.dataTransfer.dropEffect = 'none';
      setIsTagDragOver(false);
      setActiveDragTagId(null);
    }
  };

  const handleTagDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const relatedTarget = e.relatedTarget as Node | null;
    if (relatedTarget && e.currentTarget.contains(relatedTarget)) {
      return;
    }
    setIsTagDragOver(false);
    setActiveDragTagId(null);
  };

  const handleTagDrop = (e: React.DragEvent) => {
    if (!isTagDragEvent(e.dataTransfer)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const activeIds = resolveDraggingTagIds();
    const ids = readTagDragIds(e.dataTransfer, activeIds);
    if (ids.length === 0) {
      setIsTagDragOver(false);
      setActiveDragTagId(null);
      return;
    }

    const movable = ids.filter((id) => {
      const tag = allTags.find((t) => t.id === id);
      return tag && tag.categoryId !== categoryId;
    });
    if (movable.length > 0) {
      void onTagDrop(movable, categoryId);
    }
    setIsTagDragOver(false);
    setActiveDragTagId(null);
  };

  const isDropHighlight = isTagDragOver && Boolean(activeDragTagId);

  return (
    <div
      className={`${className}${isDropHighlight ? ' arc-category-panel-tags--drop-target' : ''}`.trim()}
      onDragOverCapture={(e) => {
        if (isTagDragEvent(e.dataTransfer)) {
          e.preventDefault();
        }
      }}
      onDragOver={handleTagDragOver}
      onDragLeave={handleTagDragLeave}
      onDrop={handleTagDrop}
    >
      {children}
    </div>
  );
}
