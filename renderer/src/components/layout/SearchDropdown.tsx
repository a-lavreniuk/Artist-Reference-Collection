/**
 * Компонент SearchDropdown - выпадающее меню поиска
 * Отображает категории, метки и историю поиска
 */

import { useState, useEffect, useMemo } from 'react';
import { getAllTags, getAllCategories, getSearchHistory } from '../../services/db';
import type { Tag, Category, SearchHistory } from '../../types';
import './SearchDropdown.css';

export interface SearchDropdownProps {
  /** Текущий поисковый запрос */
  searchQuery: string;
  
  /** Выбранные метки */
  selectedTags: string[];
  
  /** Обработчик выбора метки */
  onTagSelect: (tagId: string) => void;
  
  /** Обработчик выбора истории поиска */
  onHistorySelect: (query: string, tagIds: string[]) => void;
  
  /** Флаг видимости */
  isVisible: boolean;
}

/**
 * Компонент SearchDropdown
 */
export const SearchDropdown = ({
  searchQuery,
  selectedTags,
  onTagSelect,
  onHistorySelect,
  isVisible
}: SearchDropdownProps) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [history, setHistory] = useState<SearchHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Загрузка данных
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [tagsData, categoriesData, historyData] = await Promise.all([
          getAllTags(),
          getAllCategories(),
          getSearchHistory()
        ]);
        
        setTags(tagsData);
        setCategories(categoriesData);
        setHistory(historyData);
      } catch (error) {
        console.error('[SearchDropdown] Ошибка загрузки данных:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isVisible) {
      loadData();
    }
  }, [isVisible]);

  // Фильтрация меток по поисковому запросу
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) {
      // Если нет поиска, показываем метки выбранной категории или все
      if (selectedCategory) {
        return tags.filter(tag => tag.categoryId === selectedCategory);
      }
      return tags;
    }

    // Поиск по названию метки (prefix match для саджеста)
    const query = searchQuery.toLowerCase().trim();
    return tags.filter(tag => 
      tag.name.toLowerCase().includes(query)
    );
  }, [tags, searchQuery, selectedCategory]);

  // Фильтрация категорий по поисковому запросу
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return categories;
    }

    const query = searchQuery.toLowerCase().trim();
    return categories.filter(cat =>
      cat.name.toLowerCase().includes(query)
    );
  }, [categories, searchQuery]);

  // Обработчик клика по категории
  const handleCategoryClick = (categoryId: string) => {
    if (selectedCategory === categoryId) {
      setSelectedCategory(null); // Убрать фильтр
    } else {
      setSelectedCategory(categoryId); // Применить фильтр
    }
  };

  // Обработчик клика по метке
  const handleTagClick = (tagId: string) => {
    onTagSelect(tagId);
  };

  // Обработчик клика по записи истории
  const handleHistoryClick = (item: SearchHistory) => {
    onHistorySelect(item.query, item.tagIds);
  };

  // Получить название категории по ID
  const getCategoryName = (categoryId: string): string => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Без категории';
  };

  // Если компонент не виден, не рендерим
  if (!isVisible) {
    return null;
  }

  // Состояние загрузки
  if (isLoading) {
    return (
      <div className="search-dropdown">
        <div className="search-dropdown__loading">
          <div className="search-dropdown__spinner" />
          <p className="search-dropdown__loading-text text-s">Загрузка...</p>
        </div>
      </div>
    );
  }

  // Если есть результаты поиска
  const hasResults = filteredTags.length > 0 || filteredCategories.length > 0;

  return (
    <div className="search-dropdown">
      <div className="search-dropdown__content">
        {/* История поиска (показывать только если нет активного запроса) */}
        {!searchQuery.trim() && history.length > 0 && (
          <div className="search-dropdown__section">
            <div className="search-dropdown__section-header">
              <h3 className="search-dropdown__section-title text-s">
                История поиска
              </h3>
            </div>
            <div className="search-dropdown__history">
              {history.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  className="search-dropdown__history-item"
                  onClick={() => handleHistoryClick(item)}
                >
                  <svg className="search-dropdown__history-icon" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 8V12L15 15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="search-dropdown__history-text text-m">
                    {item.query || 'Поиск по меткам'}
                  </span>
                  {item.tagIds.length > 0 && (
                    <span className="search-dropdown__history-count text-s">
                      {item.tagIds.length} {item.tagIds.length === 1 ? 'метка' : 'метки'}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Категории */}
        {filteredCategories.length > 0 && (
          <div className="search-dropdown__section">
            <div className="search-dropdown__section-header">
              <h3 className="search-dropdown__section-title text-s">
                Категории
              </h3>
              {selectedCategory && (
                <button
                  className="search-dropdown__clear-filter text-s"
                  onClick={() => setSelectedCategory(null)}
                >
                  Сбросить фильтр
                </button>
              )}
            </div>
            <div className="search-dropdown__categories">
              {filteredCategories.map((category) => {
                const categoryTagsCount = tags.filter(t => t.categoryId === category.id).length;
                const isActive = selectedCategory === category.id;
                
                return (
                  <button
                    key={category.id}
                    className={`search-dropdown__category ${isActive ? 'search-dropdown__category--active' : ''}`}
                    onClick={() => handleCategoryClick(category.id)}
                  >
                    <span className="search-dropdown__category-name text-m">
                      {category.name}
                    </span>
                    <span className="search-dropdown__category-count text-s">
                      {categoryTagsCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Метки */}
        {filteredTags.length > 0 && (
          <div className="search-dropdown__section">
            <div className="search-dropdown__section-header">
              <h3 className="search-dropdown__section-title text-s">
                {searchQuery.trim() ? 'Найденные метки' : 'Все метки'}
              </h3>
            </div>
            <div className="search-dropdown__tags">
              {filteredTags
                .sort((a, b) => b.cardCount - a.cardCount) // Сортировка по популярности
                .slice(0, 20) // Показываем максимум 20 меток
                .map((tag) => {
                  const isSelected = selectedTags.includes(tag.id);
                  
                  return (
                    <button
                      key={tag.id}
                      className={`search-dropdown__tag ${isSelected ? 'search-dropdown__tag--selected' : ''}`}
                      onClick={() => handleTagClick(tag.id)}
                    >
                      <span className="search-dropdown__tag-name text-m">
                        {tag.name}
                      </span>
                      <span className="search-dropdown__tag-meta text-s">
                        <span className="search-dropdown__tag-category">
                          {getCategoryName(tag.categoryId)}
                        </span>
                        <span className="search-dropdown__tag-count">
                          {tag.cardCount}
                        </span>
                      </span>
                    </button>
                  );
                })}
            </div>
            {filteredTags.length > 20 && (
              <p className="search-dropdown__more-info text-s">
                И еще {filteredTags.length - 20} меток. Уточните запрос для более точного поиска.
              </p>
            )}
          </div>
        )}

        {/* Нет результатов */}
        {!hasResults && searchQuery.trim() && (
          <div className="search-dropdown__empty">
            <svg className="search-dropdown__empty-icon" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="search-dropdown__empty-title text-m">
              Ничего не найдено
            </p>
            <p className="search-dropdown__empty-text text-s">
              Попробуйте изменить поисковый запрос
            </p>
          </div>
        )}

        {/* Пустое состояние (нет ни меток, ни категорий) */}
        {!hasResults && !searchQuery.trim() && tags.length === 0 && (
          <div className="search-dropdown__empty">
            <svg className="search-dropdown__empty-icon" viewBox="0 0 24 24" fill="none">
              <path
                d="M7 7H17M7 12H17M7 17H13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="search-dropdown__empty-title text-m">
              Нет меток
            </p>
            <p className="search-dropdown__empty-text text-s">
              Создайте метки для организации карточек
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchDropdown;

