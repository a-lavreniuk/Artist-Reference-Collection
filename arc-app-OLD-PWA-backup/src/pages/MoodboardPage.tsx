/**
 * Страница мудборда
 */

import { useState, useEffect, useMemo } from 'react';
import { Layout } from '../components/layout';
import { Button } from '../components/common';
import { MasonryGrid } from '../components/gallery';
import { getAllCards } from '../services/db';
import type { Card, ViewMode, ContentFilter } from '../types';

export const MoodboardPage = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  
  // Состояние данных
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Загрузка карточек в мудборде
  useEffect(() => {
    const loadMoodboardCards = async () => {
      try {
        setIsLoading(true);
        const allCards = await getAllCards();
        // Фильтруем только карточки в мудборде
        const moodboardCards = allCards.filter(card => card.inMoodboard);
        setCards(moodboardCards);
      } catch (error) {
        console.error('Ошибка загрузки мудборда:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMoodboardCards();
  }, []);

  // Фильтрация карточек по типу
  const filteredCards = useMemo(() => {
    let filtered = [...cards];

    if (contentFilter === 'images') {
      filtered = filtered.filter(card => card.type === 'image');
    } else if (contentFilter === 'videos') {
      filtered = filtered.filter(card => card.type === 'video');
    }

    return filtered;
  }, [cards, contentFilter]);

  // Подсчёт по типам
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
    console.log('Clicked moodboard card:', card);
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
          title: 'Мудборд'
        }}
        showSearch={false}
      >
        <div className="layout__loading">
          <div className="layout__spinner" />
          <p className="layout__loading-text">Загрузка мудборда...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      headerProps={{
        title: 'Мудборд',
        viewMode: {
          current: viewMode,
          onChange: setViewMode
        },
        contentFilter: {
          current: contentFilter,
          counts,
          onChange: setContentFilter
        },
        actions: (
          <>
            <Button variant="secondary" size="medium">
              Выгрузить мудборд
            </Button>
            <Button variant="danger" size="medium">
              Удалить мудборд
            </Button>
          </>
        )
      }}
      showSearch={false}
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

export default MoodboardPage;

