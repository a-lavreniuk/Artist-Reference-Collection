import { type ReactNode, useState } from 'react';
import type { TagRecord } from '../../services/db';

type Props = {
  categoryId: string;
  draggingTagId: string | null;
  allTags: TagRecord[];
  onTagDrop: (tagId: string, targetCategoryId: string) => void | Promise<void>;
  className?: string;
  children: ReactNode;
};

/**
 * Зона сброса метки в категорию (HTML5 DnD). Поведение согласовано с CategorySection.
 */
export default function TagCategoryDropSurface({
  categoryId,
  draggingTagId,
  allTags,
  onTagDrop,
  className = '',
  children
}: Props) {
  const [isTagDragOver, setIsTagDragOver] = useState(false);
  const [activeDragTagId, setActiveDragTagId] = useState<string | null>(null);

  const handleTagDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/tag-id')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    if (!draggingTagId) {
      e.dataTransfer.dropEffect = 'none';
      setIsTagDragOver(false);
      setActiveDragTagId(null);
      return;
    }

    const tag = allTags.find((t) => t.id === draggingTagId);
    if (tag && tag.categoryId !== categoryId) {
      e.dataTransfer.dropEffect = 'move';
      setIsTagDragOver(true);
      setActiveDragTagId(draggingTagId);
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
    if (!e.dataTransfer.types.includes('application/tag-id')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const tagId =
      draggingTagId ||
      e.dataTransfer.getData('application/tag-id') ||
      e.dataTransfer.getData('text/plain');
    if (tagId) {
      const tag = allTags.find((t) => t.id === tagId);
      if (tag && tag.categoryId !== categoryId) {
        void onTagDrop(tagId, categoryId);
      }
    }
    setIsTagDragOver(false);
    setActiveDragTagId(null);
  };

  const isDropHighlight = isTagDragOver && Boolean(activeDragTagId);

  return (
    <div
      className={`${className}${isDropHighlight ? ' arc-category-panel-tags--drop-target' : ''}`.trim()}
      onDragOverCapture={(e) => {
        if (e.dataTransfer.types.includes('application/tag-id')) {
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
