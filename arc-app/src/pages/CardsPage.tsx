/**
 * Страница карточек - главная страница приложения
 */

import { useState, useEffect, useMemo } from 'react';
import { Layout } from '../components/layout';
import { MasonryGrid } from '../components/gallery';
import { getAllCards } from '../services/db';
import type { Card, ViewMode, ContentFilter } from '../types';

export const CardsPage = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [searchValue, setSearchValue] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  
  // Состояние данных
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Загрузка карточек при монтировании
  useEffect(() => {
    const loadCards = async () => {
      try {
        setIsLoading(true);
        const allCards = await getAllCards();
        setCards(allCards);
      } catch (error) {
        console.error('Ошибка загрузки карточек:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCards();
  }, []);

  // Фильтрация карточек
  const filteredCards = useMemo(() => {
    let filtered = [...cards];

    // Фильтр по типу контента
    if (contentFilter === 'images') {
      filtered = filtered.filter(card => card.type === 'image');
    } else if (contentFilter === 'videos') {
      filtered = filtered.filter(card => card.type === 'video');
    }

    // Фильтр по меткам
    if (selectedTags.length > 0) {
      filtered = filtered.filter(card =>
        selectedTags.every(tagId => card.tags.includes(tagId))
      );
    }

    // Сортировка по дате добавления (новые сверху)
    filtered.sort((a, b) => 
      new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
    );

    return filtered;
  }, [cards, contentFilter, selectedTags]);

  // Подсчёт карточек по типам
  const counts = useMemo(() => {
    const imageCards = cards.filter(c => c.type === 'image');
    const videoCards = cards.filter(c => c.type === 'video');
    
    return {
      all: cards.length,
      images: imageCards.length,
      videos: videoCards.length
    };
  }, [cards]);

  // Обработчик клика по карточке
  const handleCardClick = (card: Card) => {
    console.log('Clicked card:', card);
    // Здесь будет открытие модального окна просмотра
  };

  // Обработчик выбора карточки
  const handleCardSelect = (card: Card, selected: boolean) => {
    if (selected) {
      setSelectedCards(prev => [...prev, card.id]);
    } else {
      setSelectedCards(prev => prev.filter(id => id !== card.id));
    }
  };

  // Состояние загрузки
  if (isLoading) {
    return (
      <Layout
        headerProps={{
          title: 'Карточки'
        }}
      >
        <div className="layout__loading">
          <div className="layout__spinner" />
          <p className="layout__loading-text">Загрузка карточек...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      headerProps={{
        title: 'Карточки',
        viewMode: {
          current: viewMode,
          onChange: setViewMode
        },
        contentFilter: {
          current: contentFilter,
          counts,
          onChange: setContentFilter
        }
      }}
      searchProps={{
        value: searchValue,
        onChange: setSearchValue,
        selectedTags,
        onTagsChange: setSelectedTags
      }}
    >
      <MasonryGrid
        cards={filteredCards}
        viewMode={viewMode}
        onCardClick={handleCardClick}
        onCardSelect={handleCardSelect}
        selectedCards={selectedCards}
      />
    </Layout>
  );
};

export default CardsPage;

