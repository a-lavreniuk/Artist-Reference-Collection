/**
 * Компонент CategorySection - секция категории с метками
 * Отображает категорию и все метки внутри неё
 */

import { useState } from 'react';
import { Tag, Button } from '../common';
import type { Category, Tag as TagType } from '../../types';
import './CategorySection.css';

export interface CategorySectionProps {
  /** Категория */
  category: Category;
  
  /** Метки в категории */
  tags: TagType[];
  
  /** Обработчик удаления метки */
  onTagRemove?: (tagId: string) => void;
  
  /** Обработчик удаления категории */
  onCategoryDelete?: (categoryId: string) => void;
  
  /** Обработчик добавления метки */
  onAddTag?: (categoryId: string) => void;
}

/**
 * Компонент CategorySection
 */
export const CategorySection = ({
  category,
  tags,
  onTagRemove,
  onCategoryDelete,
  onAddTag
}: CategorySectionProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="category-section">
      {/* Шапка категории */}
      <div className="category-section__header">
        <button
          className="category-section__toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            className={isExpanded ? 'category-section__toggle-icon--expanded' : ''}
          >
            <path
              d="M9 18L15 12L9 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className="category-section__title-wrapper">
          <h3 className="category-section__title">
            {category.name}
          </h3>
          <span className="category-section__count text-s">
            {tags.length} {tags.length === 1 ? 'метка' : 'меток'}
          </span>
        </div>

        <div className="category-section__actions">
          <Button
            variant="ghost"
            size="small"
            onClick={() => onAddTag?.(category.id)}
          >
            + Добавить метку
          </Button>
          <Button
            variant="ghost"
            size="small"
            onClick={() => onCategoryDelete?.(category.id)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 6H5H21M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Button>
        </div>
      </div>

      {/* Список меток */}
      {isExpanded && (
        <div className="category-section__content">
          {tags.length > 0 ? (
            <div className="category-section__tags">
              {tags.map((tag) => (
                <Tag
                  key={tag.id}
                  variant="default"
                  removable
                  count={tag.cardCount}
                  color={tag.color}
                  onRemove={() => onTagRemove?.(tag.id)}
                >
                  {tag.name}
                </Tag>
              ))}
            </div>
          ) : (
            <p className="category-section__empty text-s">
              В этой категории пока нет меток
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CategorySection;

