/**
 * Страница карточек - главная страница приложения
 */

import { useState, useEffect, useMemo } from 'react';
import { Layout } from '../components/layout';
import { MasonryGrid, CardViewModal } from '../components/gallery';
import { getAllCards, searchCardsAdvanced } from '../services/db';
import { useSearchNavigation } from '../hooks';
import type { Card, ViewMode, ContentFilter } from '../types';

export const CardsPage = () => {
  // Используем хук для управления поиском
  const {
    searchValue,
    setSearchValue,
    selectedTags,
    setSelectedTags,
    viewingCard,
    isModalOpen,
    handleCardClick: handleSearchCardClick,
    handleCloseModal,
    searchProps
  } = useSearchNavigation();
  
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
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

  // Поиск с debounce (300мс)
  useEffect(() => {
    if (!searchValue.trim()) {
      return; // Если поиск пустой, используем все карточки
    }

    const timeoutId = setTimeout(async () => {
      try {
        const results = await searchCardsAdvanced(searchValue);
        setCards(results);
      } catch (error) {
        console.error('Ошибка поиска:', error);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchValue]);

  // Сброс поиска при очистке
  useEffect(() => {
    if (!searchValue.trim()) {
      const resetCards = async () => {
        const allCards = await getAllCards();
        setCards(allCards);
      };
      resetCards();
    }
  }, [searchValue]);

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

  // Обработчик клика по карточке из галереи
  const handleCardClick = (card: Card) => {
    handleSearchCardClick(card);
  };

  // Обработчик обновления карточки
  const handleCardUpdated = async () => {
    // Перезагружаем карточки
    const allCards = await getAllCards();
    setCards(allCards);
    
    // Обновляем просматриваемую карточку
    if (viewingCard) {
      const updatedCard = allCards.find(c => c.id === viewingCard.id);
      if (updatedCard) {
        setViewingCard(updatedCard);
      }
    }
  };

  // Обработчик удаления карточки
  const handleCardDeleted = async () => {
    const allCards = await getAllCards();
    setCards(allCards);
    setViewingCard(null);
    setIsModalOpen(false);
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
      searchProps={searchProps}
    >
      <MasonryGrid
        cards={filteredCards}
        viewMode={viewMode}
        onCardClick={handleCardClick}
        onCardSelect={handleCardSelect}
        selectedCards={selectedCards}
      />

      {/* Модальное окно просмотра карточки */}
      <CardViewModal
        isOpen={isModalOpen}
        card={viewingCard}
        onClose={handleCloseModal}
        onCardUpdated={handleCardUpdated}
        onCardDeleted={handleCardDeleted}
        onSimilarCardClick={(card) => {
          setViewingCard(card);
        }}
      />
    </Layout>
  );
};

export default CardsPage;

