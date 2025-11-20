/**
 * Страница карточек - главная страница приложения
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout';
import { MasonryGrid, CardViewModal } from '../components/gallery';
import { getAllCards, addToMoodboard, removeFromMoodboard, getMoodboard, searchCardsAdvanced } from '../services/db';
import { useSearch } from '../contexts';
import type { Card, ViewMode, ContentFilter } from '../types';

export const CardsPage = () => {
  const navigate = useNavigate();
  
  // Используем глобальный контекст поиска
  const {
    selectedTags,
    setSelectedTags,
    viewingCard,
    isModalOpen,
    handleCardClick: handleSearchCardClick,
    handleCloseModal,
    updateViewingCard,
    searchProps,
    searchValue
  } = useSearch();
  
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  
  // Состояние данных
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [moodboardCardIds, setMoodboardCardIds] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<Card[] | null>(null);

  // Загрузка карточек при монтировании
  useEffect(() => {
    const loadCards = async () => {
      try {
        setIsLoading(true);
        
        const allCards = await getAllCards();
        const moodboard = await getMoodboard();
        setCards(allCards);
        setMoodboardCardIds(moodboard.cardIds);
      } catch (error) {
        console.error('Ошибка загрузки карточек:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCards();
  }, []);

  // Поиск по ID или меткам при изменении searchValue
  useEffect(() => {
    const performSearch = async () => {
      if (searchValue && searchValue.trim()) {
        try {
          const results = await searchCardsAdvanced(searchValue.trim());
          setSearchResults(results);
          console.log('[CardsPage] Поиск по запросу:', searchValue, 'найдено:', results.length);
        } catch (error) {
          console.error('[CardsPage] Ошибка поиска:', error);
          setSearchResults(null);
        }
      } else {
        setSearchResults(null);
      }
    };

    // Debounce для поиска (300мс)
    const timeoutId = setTimeout(performSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [searchValue]);

  // Фильтрация карточек
  const filteredCards = useMemo(() => {
    // Если есть результаты поиска - используем их, иначе все карточки
    let filtered = searchResults !== null ? [...searchResults] : [...cards];

    // Фильтр по типу контента
    if (contentFilter === 'images') {
      filtered = filtered.filter(card => card.type === 'image');
    } else if (contentFilter === 'videos') {
      filtered = filtered.filter(card => card.type === 'video');
    }

    // Фильтр по меткам (применяется даже если есть результаты поиска)
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
  }, [cards, contentFilter, selectedTags, searchResults]);

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
    
    // Обновляем viewingCard если она открыта (без закрытия модалки)
    if (viewingCard) {
      const updatedCard = allCards.find(c => c.id === viewingCard.id);
      if (updatedCard) {
        updateViewingCard(updatedCard);
      }
    }
  };

  // Обработчик удаления карточки
  const handleCardDeleted = async () => {
    const allCards = await getAllCards();
    setCards(allCards);
    handleCloseModal();
  };

  // Обработчик выбора карточки
  const handleCardSelect = (card: Card, selected: boolean) => {
    if (selected) {
      setSelectedCards(prev => [...prev, card.id]);
    } else {
      setSelectedCards(prev => prev.filter(id => id !== card.id));
    }
  };

  // Обработчик добавления/удаления из мудборда
  const handleMoodboardToggle = async (card: Card) => {
    const isInMoodboard = moodboardCardIds.includes(card.id);
    console.log('[CardsPage] Клик на кнопку мудборда для карточки:', card.id, 'текущий статус в мудборде:', isInMoodboard);
    
    try {
      if (isInMoodboard) {
        console.log('[CardsPage] Удаляем из мудборда');
        await removeFromMoodboard(card.id);
      } else {
        console.log('[CardsPage] Добавляем в мудборд');
        await addToMoodboard(card.id);
      }
      
      console.log('[CardsPage] Перезагружаем карточки');
      // Перезагружаем карточки и мудборд для обновления состояния
      const allCards = await getAllCards();
      const moodboard = await getMoodboard();
      setCards(allCards);
      setMoodboardCardIds(moodboard.cardIds);
    } catch (error) {
      console.error('[CardsPage] Ошибка переключения мудборда:', error);
    }
  };

  // Обработчик клика на коллекцию
  const handleCollectionClick = (collectionId: string) => {
    console.log('Навигация к коллекции:', collectionId);
    handleCloseModal();
    navigate(`/collections/${collectionId}`);
  };

  // Обработчик клика на метку
  const handleTagClick = (tagId: string) => {
    console.log('Поиск по метке:', tagId);
    handleCloseModal();
    setSelectedTags([tagId]);
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
        onMoodboardToggle={handleMoodboardToggle}
        selectedCards={selectedCards}
        moodboardCardIds={moodboardCardIds}
      />

      {/* Модальное окно просмотра карточки */}
      <CardViewModal
        isOpen={isModalOpen}
        card={viewingCard}
        onClose={handleCloseModal}
        onCardUpdated={handleCardUpdated}
        onCardDeleted={handleCardDeleted}
        onSimilarCardClick={(card) => {
          handleSearchCardClick(card);
        }}
        onCollectionClick={handleCollectionClick}
        onTagClick={handleTagClick}
      />
    </Layout>
  );
};

export default CardsPage;

