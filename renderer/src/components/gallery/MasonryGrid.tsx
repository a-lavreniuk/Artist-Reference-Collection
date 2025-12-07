/**
 * Компонент MasonryGrid - галерея в стиле Pinterest
 * Отображает карточки с сохранением пропорций в masonry layout
 * Использует виртуализацию для оптимизации производительности
 */

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import Masonry from 'react-masonry-css';
import { Card, CardSkeleton } from '../common';
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
  
  /** Обработчик загрузки следующей порции карточек */
  onLoadMore?: () => void;
  
  /** Есть ли еще карточки для загрузки */
  hasMore?: boolean;
  
  /** Идет ли загрузка дополнительных карточек */
  isLoadingMore?: boolean;
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
  moodboardCardIds = [],
  onLoadMore,
  hasMore = false,
  isLoadingMore = false
}: MasonryGridProps) => {
  const [visibleCards, setVisibleCards] = useState<Set<string>>(new Set());
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreObserverRef = useRef<IntersectionObserver | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);
  const prevViewModeRef = useRef<ViewMode>(viewMode);

  // Инициализация видимых карточек при изменении списка cards
  useEffect(() => {
    // При изменении списка карточек инициализируем видимыми первые 300
    // Увеличено до 300 для гарантированного покрытия всех колонок при любом режиме
    const initialVisible = new Set(cards.slice(0, 300).map(card => card.id));
    setVisibleCards(initialVisible);
  }, [cards]);

  // Специальный эффект для обработки смены viewMode
  useEffect(() => {
    if (prevViewModeRef.current !== viewMode) {
      // При смене viewMode временно показываем ВСЕ карточки для корректного пересчета layout
      // Это предотвращает появление "дыр" во время перестройки Masonry сетки
      // Observer позже оптимизирует список видимых карточек
      const allVisible = new Set(cards.map(card => card.id));
      setVisibleCards(allVisible);
      prevViewModeRef.current = viewMode;
    }
  }, [viewMode, cards]);

  // Создаем и обновляем Intersection Observer
  useEffect(() => {
    let rafId1: number;
    let rafId2: number;

    // При смене viewMode дожидаемся пересчета layout через два фрейма
    // Первый фрейм - для обновления DOM, второй - для пересчета layout
    rafId1 = requestAnimationFrame(() => {
      rafId2 = requestAnimationFrame(() => {
        // Создаем observer с большим запасом для предзагрузки
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
                    if (entry.boundingClientRect.top > window.innerHeight * 3) {
                      next.delete(cardId);
                    }
                  }
                  return next;
                });
              }
            });
          },
          {
            rootMargin: '1000px' // Загружаем карточки за 1000px до появления для плавного скролла
          }
        );

        // Наблюдаем за всеми карточками
        cardRefs.current.forEach((element) => {
          if (element && observerRef.current) {
            observerRef.current.observe(element);
          }
        });
      });
    });

    return () => {
      cancelAnimationFrame(rafId1);
      cancelAnimationFrame(rafId2);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [cards, viewMode]); // Пересоздаем при изменении cards или viewMode

  // Intersection Observer для автоматической подгрузки
  useEffect(() => {
    if (!onLoadMore || !hasMore || isLoadingMore) {
      return;
    }

    // Создаем observer для отслеживания триггера подгрузки
    loadMoreObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && hasMore && !isLoadingMore && onLoadMore) {
            onLoadMore();
          }
        });
      },
      {
        rootMargin: '200px' // Начинаем загрузку за 200px до конца списка
      }
    );

    // Наблюдаем за триггером подгрузки
    if (loadMoreTriggerRef.current && loadMoreObserverRef.current) {
      loadMoreObserverRef.current.observe(loadMoreTriggerRef.current);
    }

    return () => {
      if (loadMoreObserverRef.current) {
        loadMoreObserverRef.current.disconnect();
      }
    };
  }, [onLoadMore, hasMore, isLoadingMore, cards.length]);

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
                // Скелетон для невидимых карточек (сохраняет layout и выглядит как настоящая карточка)
                <CardSkeleton compact={viewMode === 'compact'} />
              )}
            </div>
          );
        })}
        
        {/* Триггер для автоматической подгрузки */}
        {onLoadMore && hasMore && (
          <div
            ref={loadMoreTriggerRef}
            className="masonry-grid__load-more-trigger"
            style={{ 
              width: '100%', 
              height: '1px', 
              marginTop: '20px',
              visibility: 'hidden'
            }}
          />
        )}
        
        {/* Индикатор загрузки */}
        {isLoadingMore && (
          <div className="masonry-grid__loading-more" style={{ width: '100%', padding: '20px', textAlign: 'center' }}>
            <div className="layout__spinner" style={{ margin: '0 auto' }} />
          </div>
        )}
      </Masonry>
    </div>
  );
};

export default MasonryGrid;

