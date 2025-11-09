/**
 * Компонент MasonryGrid - галерея в стиле Pinterest
 * Отображает карточки с сохранением пропорций в masonry layout
 */

import { useMemo } from 'react';
import Masonry from 'react-masonry-css';
import { Card } from '../common';
import type { Card as CardType, ViewMode } from '../../types';
import './MasonryGrid.css';

export interface MasonryGridProps {
  /** Массив карточек для отображения */
  cards: CardType[];
  
  /** Режим отображения */
  viewMode?: ViewMode;
  
  /** Обработчик клика по карточке */
  onCardClick?: (card: CardType) => void;
  
  /** Обработчик выбора карточки */
  onCardSelect?: (card: CardType, selected: boolean) => void;
  
  /** Обработчик добавления/удаления из мудборда */
  onMoodboardToggle?: (card: CardType) => void;
  
  /** Выбранные карточки */
  selectedCards?: string[];
  
  /** Показывать действия на карточках */
  showActions?: boolean;
}

/**
 * Компонент MasonryGrid
 */
export const MasonryGrid = ({
  cards,
  viewMode = 'standard',
  onCardClick,
  onCardSelect,
  onMoodboardToggle,
  selectedCards = [],
  showActions = true
}: MasonryGridProps) => {
  // Определяем количество колонок в зависимости от режима
  const breakpointColumns = useMemo(() => {
    if (viewMode === 'compact') {
      return {
        default: 10,
        2400: 10,
        2000: 8,
        1920: 10
      };
    }
    
    // Стандартный режим
    return {
      default: 6,
      2400: 6,
      2000: 5,
      1920: 6
    };
  }, [viewMode]);

  // Пустое состояние
  if (cards.length === 0) {
    return (
      <div className="masonry-grid__empty">
        <div className="layout__empty-state">
          <div className="layout__empty-icon">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M4 4H10V10H4V4ZM14 4H20V10H14V4ZM14 14H20V20H14V14ZM4 14H10V20H4V14Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h3 className="layout__empty-title">Карточек не найдено</h3>
          <p className="layout__empty-text text-m">
            Попробуйте изменить фильтры или добавьте новые карточки
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`masonry-grid masonry-grid--${viewMode}`}>
      <Masonry
        breakpointCols={breakpointColumns}
        className="masonry-grid__container"
        columnClassName="masonry-grid__column"
      >
        {cards.map((card) => (
          <div key={card.id} className="masonry-grid__item">
            <Card
              card={card}
              compact={viewMode === 'compact'}
              selected={selectedCards.includes(card.id)}
              onClick={onCardClick}
              onSelect={onCardSelect}
              onMoodboardToggle={onMoodboardToggle}
              showActions={showActions}
            />
          </div>
        ))}
      </Masonry>
    </div>
  );
};

export default MasonryGrid;

