/**
 * Компонент CategorySection - секция категории с метками
 * Отображает категорию и все метки внутри неё
 * Клик на всю категорию открывает модальное окно редактирования
 */

import { Tag } from '../common';
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
}

/**
 * Компонент CategorySection
 */
export const CategorySection = ({
  category,
  tags,
  onCategoryClick,
  onTagClick
}: CategorySectionProps) => {
  // Сортируем метки по количеству использований (cardCount) от большего к меньшему
  const sortedTags = [...tags].sort((a, b) => (b.cardCount || 0) - (a.cardCount || 0));

  const handleCategoryClick = () => {
    onCategoryClick?.(category.id);
  };

  const handleTagClick = (e: React.MouseEvent, tagId: string) => {
    e.stopPropagation(); // Останавливаем всплытие, чтобы не открылось модальное окно категории
    onTagClick?.(tagId);
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
      </div>

      {/* Список меток */}
      {sortedTags.length > 0 && (
        <div className="category-section__tags">
          {sortedTags.map((tag) => (
            <Tag
              key={tag.id}
              variant="default"
              count={tag.cardCount || 0}
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
