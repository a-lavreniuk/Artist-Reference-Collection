/**
 * Компонент MasonryGrid - галерея в стиле Pinterest
 * Отображает карточки с сохранением пропорций в masonry layout
 * Использует виртуализацию для оптимизации производительности
 */

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
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
  
  /** Массив ID карточек в мудборде (для определения статуса) */
  moodboardCardIds?: string[];
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
  showActions = true,
  moodboardCardIds = []
}: MasonryGridProps) => {
  const [visibleCards, setVisibleCards] = useState<Set<string>>(new Set());
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Создаем Intersection Observer для виртуализации
  useEffect(() => {
    // Инициализируем видимыми первые 20 карточек для быстрой загрузки
    const initialVisible = new Set(cards.slice(0, 20).map(card => card.id));
    setVisibleCards(initialVisible);

    // Создаем observer с запасом в 200px для предзагрузки
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const cardId = entry.target.getAttribute('data-card-id');
          if (cardId) {
            setVisibleCards((prev) => {
              const next = new Set(prev);
              if (entry.isIntersecting) {
                next.add(cardId);
              } else {
                // Не удаляем сразу, чтобы избежать мерцания
                // Удаляем только если карточка далеко за пределами viewport
                if (entry.boundingClientRect.top > window.innerHeight * 2) {
                  next.delete(cardId);
                }
              }
              return next;
            });
          }
        });
      },
      {
        rootMargin: '200px' // Загружаем карточки за 200px до появления
      }
    );

    // Наблюдаем за всеми карточками
    cardRefs.current.forEach((element) => {
      if (element && observerRef.current) {
        observerRef.current.observe(element);
      }
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [cards]);

  // Callback для установки ref карточки
  const setCardRef = useCallback((cardId: string, element: HTMLDivElement | null) => {
    if (element) {
      cardRefs.current.set(cardId, element);
      if (observerRef.current) {
        observerRef.current.observe(element);
      }
    } else {
      const existing = cardRefs.current.get(cardId);
      if (existing && observerRef.current) {
        observerRef.current.unobserve(existing);
      }
      cardRefs.current.delete(cardId);
    }
  }, []);

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
        {cards.map((card) => {
          const isVisible = visibleCards.has(card.id);
          return (
            <div
              key={card.id}
              className="masonry-grid__item"
              data-card-id={card.id}
              ref={(el) => setCardRef(card.id, el)}
            >
              {isVisible ? (
                <Card
                  card={card}
                  compact={viewMode === 'compact'}
                  selected={selectedCards.includes(card.id)}
                  onClick={onCardClick}
                  onSelect={onCardSelect}
                  onMoodboardToggle={onMoodboardToggle}
                  showActions={showActions}
                  moodboardCardIds={moodboardCardIds}
                />
              ) : (
                // Плейсхолдер для невидимых карточек (сохраняет layout)
                <div style={{ width: '100%', height: '200px', backgroundColor: 'var(--color-grayscale-100, #ebe9ee)' }} />
              )}
            </div>
          );
        })}
      </Masonry>
    </div>
  );
};

export default MasonryGrid;

