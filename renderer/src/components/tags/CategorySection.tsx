/**
 * Компонент CategorySection - секция категории с метками
 * Отображает категорию и все метки внутри неё
 * Клик на всю категорию открывает модальное окно редактирования
 */

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
  canMoveDown = false
}: CategorySectionProps) => {
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

  return (
    <div 
      className="category-section" 
      onClick={handleCategoryClick}
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
              variant="default"
              count={tag.cardCount || 0}
              description={tag.description}
              onClick={(e) => handleTagClick(e as any, tag.id)}
              style={{ cursor: 'pointer' }}
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
