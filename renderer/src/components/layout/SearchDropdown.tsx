/**
 * Компонент SearchDropdown - выпадающее меню поиска
 * Отображает категории с метками, историю поиска и недавно просмотренные карточки
 * Дизайн согласно макету Figma
 */

import { useState, useEffect } from 'react';
import { Icon } from '../common';
import { 
  getAllTags, 
  getAllCategories, 
  getSearchHistory, 
  getViewHistory,
  getCard
} from '../../services/db';
import type { Tag, Category, Card } from '../../types';
import './SearchDropdown.css';

export interface SearchDropdownProps {
  /** Поисковый запрос для фильтрации меток */
  searchQuery: string;
  
  /** Выбранные метки */
  selectedTags: string[];
  
  /** Обработчик выбора метки */
  onTagSelect: (tagId: string) => void;
  
  /** Обработчик выбора метки из истории */
  onHistoryTagSelect: (tagIds: string[]) => void;
  
  /** Обработчик клика по недавно просмотренной карточке */
  onRecentCardClick?: (card: Card) => void;
  
  /** Флаг видимости */
  isVisible: boolean;
  
  /** Обработчик закрытия dropdown (при клике на overlay) */
  onClose?: () => void;
}

// Интерфейс для группировки меток по категориям
interface CategoryWithTags extends Category {
  tags: Tag[];
}

/**
 * Компонент SearchDropdown
 */
export const SearchDropdown = ({
  searchQuery,
  selectedTags,
  onTagSelect,
  onHistoryTagSelect,
  onRecentCardClick,
  isVisible,
  onClose
}: SearchDropdownProps) => {
  const [categoriesWithTags, setCategoriesWithTags] = useState<CategoryWithTags[]>([]);
  const [recentSearchTags, setRecentSearchTags] = useState<Tag[]>([]);
  const [recentCards, setRecentCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Блокировка скролла контента когда dropdown открыт
  useEffect(() => {
    if (isVisible) {
      // Находим layout__content и блокируем скролл
      const layoutContent = document.querySelector('.layout__content') as HTMLElement;
      if (layoutContent) {
        // Сохраняем текущую ширину скроллбара
        const scrollbarWidth = layoutContent.offsetWidth - layoutContent.clientWidth;
        
        // Блокируем скролл
        layoutContent.style.overflow = 'hidden';
        
        // Компенсируем исчезновение скроллбара padding'ом
        if (scrollbarWidth > 0) {
          layoutContent.style.paddingRight = `calc(var(--spacing-2xl) + ${scrollbarWidth}px)`;
        }
      }
      
      return () => {
        // Восстанавливаем скролл при закрытии
        if (layoutContent) {
          layoutContent.style.overflow = '';
          layoutContent.style.paddingRight = '';
        }
      };
    }
  }, [isVisible]);

  // Загрузка данных при открытии
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Загружаем все данные параллельно
        const [allTags, allCategories, searchHistory, viewHistory] = await Promise.all([
          getAllTags(),
          getAllCategories(),
          getSearchHistory(),
          getViewHistory()
        ]);
        
        // Группируем метки по категориям
        const grouped: CategoryWithTags[] = allCategories.map(category => ({
          ...category,
          tags: allTags.filter(tag => tag.categoryId === category.id)
        }));
        setCategoriesWithTags(grouped);
        
        // Получаем метки из последнего поискового запроса
        if (searchHistory.length > 0 && searchHistory[0].tagIds.length > 0) {
          const lastSearchTagIds = searchHistory[0].tagIds;
          const lastSearchTags = allTags.filter(tag => lastSearchTagIds.includes(tag.id));
          setRecentSearchTags(lastSearchTags);
        }
        
        // Получаем недавно просмотренные карточки
        const recentCardIds = viewHistory.slice(0, 23).map(h => h.cardId);
        console.log('[SearchDropdown] История просмотров:', viewHistory.length, 'записей');
        
        const cards: Card[] = [];
        for (const cardId of recentCardIds) {
          const card = await getCard(cardId);
          if (card) {
            cards.push(card);
          }
        }
        console.log('[SearchDropdown] Загружено недавно просмотренных карточек:', cards.length);
        setRecentCards(cards);
        
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

  // Обработчик клика по метке из недавних запросов
  const handleRecentSearchTagClick = (tagId: string) => {
    // Удаляем метку из недавних запросов
    const remainingTags = recentSearchTags.filter(t => t.id !== tagId);
    setRecentSearchTags(remainingTags);
    
    // Если остались метки, обновляем историю
    if (remainingTags.length > 0) {
      onHistoryTagSelect(remainingTags.map(t => t.id));
    }
  };

  // Обработчик клика по недавно просмотренной карточке
  const handleRecentCardClick = (card: Card) => {
    onRecentCardClick?.(card);
  };

  // Обработчик клика на overlay (закрывает dropdown)
  const handleOverlayClick = () => {
    onClose?.();
  };

  // Если компонент не виден, не рендерим
  if (!isVisible) {
    return null;
  }

  // Состояние загрузки
  if (isLoading) {
    return (
      <>
        <div className="search-dropdown-overlay" onClick={handleOverlayClick} />
        <div className="search-dropdown">
          <div className="search-dropdown__loading">
            <p className="text-s" style={{ color: 'var(--text-secondary)' }}>Загрузка...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="search-dropdown-overlay" onClick={handleOverlayClick} />
      <div className="search-dropdown">
      <div className="search-dropdown__content">
        {/* Недавние запросы */}
        {recentSearchTags.length > 0 && (
          <div className="search-dropdown__section search-dropdown__section--recent">
            <h3 className="search-dropdown__title text-m">Недавние запросы</h3>
            <div className="search-dropdown__tags-row">
              {recentSearchTags.map((tag) => (
                <button
                  key={tag.id}
                  className="search-dropdown__tag-chip"
                  onClick={() => handleRecentSearchTagClick(tag.id)}
                >
                  <span className="search-dropdown__tag-chip-text text-s">
                    {tag.name}
                  </span>
                  <Icon 
                    name="x" 
                    size={16} 
                    variant="border"
                    className="search-dropdown__tag-chip-icon" 
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Недавно просмотренные */}
        {recentCards.length > 0 && (
          <div className="search-dropdown__section search-dropdown__section--viewed">
            <h3 className="search-dropdown__title text-m">Недавно просмотренные</h3>
            <div className="search-dropdown__cards-row">
              {recentCards.map((card, index) => (
                <button
                  key={`recent-card-${card.id}-${index}`}
                  className="search-dropdown__card-thumb"
                  onClick={() => handleRecentCardClick(card)}
                  style={{ 
                    backgroundImage: card.thumbnailUrl ? `url(${card.thumbnailUrl})` : undefined,
                    backgroundColor: 'var(--bg-tertiary)'
                  }}
                  aria-label={`Просмотреть карточку ${card.fileName}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Разделитель */}
        {(recentSearchTags.length > 0 || recentCards.length > 0) && categoriesWithTags.length > 0 && (
          <div className="search-dropdown__divider" />
        )}

        {/* Категории с метками */}
        <div className="search-dropdown__categories-section">
          {categoriesWithTags
            .filter(category => {
              // Фильтрация категорий по поисковому запросу
              if (!searchQuery.trim()) return true;
              const query = searchQuery.toLowerCase();
              
              // Показываем категорию если её название или хотя бы одна метка содержит запрос
              const categoryMatches = category.name.toLowerCase().includes(query);
              const hasMatchingTag = category.tags.some(tag => 
                tag.name.toLowerCase().includes(query)
              );
              
              return categoryMatches || hasMatchingTag;
            })
            .map((category) => {
              // Фильтруем метки внутри категории по поисковому запросу
              const filteredTags = searchQuery.trim()
                ? category.tags.filter(tag => 
                    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                : category.tags;
              
              // Не показываем категорию если в ней нет меток после фильтрации
              if (filteredTags.length === 0) return null;
              
              return (
                <div key={category.id} className="search-dropdown__category-block">
                  <h3 className="search-dropdown__category-title text-m">{category.name}</h3>
                  <div className="search-dropdown__tags-row">
                    {filteredTags.map((tag) => {
                      const isSelected = selectedTags.includes(tag.id);
                      
                      return (
                        <button
                          key={tag.id}
                          className={`search-dropdown__tag-button ${isSelected ? 'search-dropdown__tag-button--selected' : ''}`}
                          onClick={() => onTagSelect(tag.id)}
                        >
                          <span className="text-s">{tag.name}</span>
                          {isSelected && (
                            <Icon 
                              name="x" 
                              size={16} 
                              variant="border"
                              className="search-dropdown__tag-button-icon" 
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Пустое состояние */}
        {categoriesWithTags.length === 0 && recentSearchTags.length === 0 && recentCards.length === 0 && (
          <div className="search-dropdown__empty">
            <p className="search-dropdown__empty-text text-m" style={{ color: 'var(--text-secondary)' }}>
              Нет меток и категорий
            </p>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default SearchDropdown;
