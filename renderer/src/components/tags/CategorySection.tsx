/**
 * Компонент CategorySection - секция категории с метками
 * Отображает категорию и все метки внутри неё
 * Клик на всю категорию открывает модальное окно редактирования
 * Поддерживает drag-and-drop для перемещения меток
 */

import { useState } from 'react';
import { Tag, Icon } from '../common';
import type { Category, Tag as TagType } from '../../types';
import './CategorySection.css';

export interface CategorySectionProps {
  /** Категория */
  category: Category;
  
  /** Метки в категории */
  tags: TagType[];
  
  /** Обработчик клика на категорию (открывает модальное окно редактирования) */
  onCategoryClick?: (categoryId: string) => void;
  
  /** Обработчик клика на метку (активирует поиск по метке) */
  onTagClick?: (tagId: string) => void;
  
  /** Обработчик изменения порядка категории (вверх) */
  onMoveUp?: (categoryId: string) => void;
  
  /** Обработчик изменения порядка категории (вниз) */
  onMoveDown?: (categoryId: string) => void;
  
  /** Можно ли переместить категорию вверх */
  canMoveUp?: boolean;
  
  /** Можно ли переместить категорию вниз */
  canMoveDown?: boolean;
  
  /** Обработчик начала перетаскивания метки */
  onTagDragStart?: (tagId: string, event: React.DragEvent) => void;
  
  /** Обработчик окончания перетаскивания метки */
  onTagDragEnd?: (tagId: string, event: React.DragEvent) => void;
  
  /** Обработчик перемещения метки в эту категорию */
  onTagDrop?: (tagId: string, targetCategoryId: string) => void;
  
  /** ID текущей перетаскиваемой метки (для визуальной обратной связи) */
  draggingTagId?: string | null;
  
  /** Все метки (для проверки категории перетаскиваемой метки) */
  allTags?: TagType[];
}

/**
 * Компонент CategorySection
 */
export const CategorySection = ({
  category,
  tags,
  onCategoryClick,
  onTagClick,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  onTagDragStart,
  onTagDragEnd,
  onTagDrop,
  draggingTagId,
  allTags
}: CategorySectionProps) => {
  const [isTagDragOver, setIsTagDragOver] = useState(false);
  const [draggedTagId, setDraggedTagId] = useState<string | null>(null);
  
  // Сортируем метки по алфавиту (а→я, a→z)
  const sortedTags = [...tags].sort((a, b) => {
    return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
  });

  const handleCategoryClick = () => {
    onCategoryClick?.(category.id);
  };

  const handleTagClick = (e: React.MouseEvent, tagId: string) => {
    e.stopPropagation(); // Останавливаем всплытие, чтобы не открылось модальное окно категории
    onTagClick?.(tagId);
  };

  const handleMoveUp = (e: React.MouseEvent) => {
    e.stopPropagation(); // Останавливаем всплытие, чтобы не открылось модальное окно категории
    onMoveUp?.(category.id);
  };

  const handleMoveDown = (e: React.MouseEvent) => {
    e.stopPropagation(); // Останавливаем всплытие, чтобы не открылось модальное окно категории
    onMoveDown?.(category.id);
  };

  // ========== DRAG-AND-DROP ДЛЯ МЕТОК ==========
  
  const handleTagDragOver = (e: React.DragEvent) => {
    // Проверяем, что перетаскивается метка (не категория)
    if (e.dataTransfer.types.includes('application/tag-id')) {
      e.preventDefault();
      e.stopPropagation();
      
      // Используем draggingTagId из props, так как getData не работает в dragOver
      if (draggingTagId) {
        // Используем allTags если доступны, иначе tags (метки текущей категории)
        const tagList = allTags || tags;
        const tag = tagList.find(t => t.id === draggingTagId);
        // Разрешаем drop только если метка не из этой категории
        if (tag && tag.categoryId !== category.id) {
          e.dataTransfer.dropEffect = 'move';
          setIsTagDragOver(true);
          setDraggedTagId(draggingTagId);
        } else {
          e.dataTransfer.dropEffect = 'none';
          setIsTagDragOver(false);
          setDraggedTagId(null);
        }
      }
    }
  };

  const handleTagDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) {
      setIsTagDragOver(false);
      setDraggedTagId(null);
    }
  };

  const handleTagDrop = (e: React.DragEvent) => {
    // Проверяем, что это drop метки (не категории)
    if (e.dataTransfer.types.includes('application/tag-id')) {
      e.preventDefault();
      e.stopPropagation();
      
      // Используем draggingTagId из props или пытаемся получить из dataTransfer
      const tagId = draggingTagId || e.dataTransfer.getData('application/tag-id') || e.dataTransfer.getData('text/plain');
      if (tagId && onTagDrop) {
        // Используем allTags если доступны, иначе tags (метки текущей категории)
        const tagList = allTags || tags;
        const tag = tagList.find(t => t.id === tagId);
        // Проверяем, что метка не из этой же категории
        if (tag && tag.categoryId !== category.id) {
          onTagDrop(tagId, category.id);
        }
      }
      
      setIsTagDragOver(false);
      setDraggedTagId(null);
    }
  };

  const isTagDropTarget = isTagDragOver && draggedTagId;

  return (
    <div 
      className={`category-section ${isTagDropTarget ? 'category-section--tag-drag-over' : ''}`}
      onClick={handleCategoryClick}
      onDragOver={(e) => {
        handleTagDragOver(e);
      }}
      onDragLeave={(e) => {
        handleTagDragLeave(e);
      }}
      onDrop={(e) => {
        handleTagDrop(e);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCategoryClick();
        }
      }}
    >
      {/* Заголовок категории */}
      <div className="category-section__header">
        <h2 className="category-section__title">
          {category.name}
        </h2>
        <span className="category-section__count">
          {tags.length}
        </span>
        <div className="category-section__order-buttons">
          <button
            className="category-section__order-button"
            onClick={handleMoveUp}
            disabled={!canMoveUp}
            title="Переместить вверх"
          >
            <Icon name="chevron-up" size={16} variant="border" />
          </button>
          <button
            className="category-section__order-button"
            onClick={handleMoveDown}
            disabled={!canMoveDown}
            title="Переместить вниз"
          >
            <Icon name="chevron-down" size={16} variant="border" />
          </button>
        </div>
      </div>

      {/* Список меток */}
      {sortedTags.length > 0 && (
        <div className="category-section__tags">
          {sortedTags.map((tag) => (
            <Tag
              key={tag.id}
              tagId={tag.id}
              draggable={true}
              variant="default"
              count={tag.cardCount || 0}
              description={tag.description}
              onClick={(e) => handleTagClick(e as any, tag.id)}
              onDragStart={onTagDragStart}
              onDragEnd={onTagDragEnd}
              style={{ cursor: 'grab' }}
            >
              {tag.name}
            </Tag>
          ))}
        </div>
      )}
      
    </div>
  );
};

export default CategorySection;
