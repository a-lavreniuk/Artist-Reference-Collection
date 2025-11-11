/**
 * Страница карточек - главная страница приложения
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout';
import { MasonryGrid, CardViewModal } from '../components/gallery';
import { getAllCards, addToMoodboard, removeFromMoodboard, syncMoodboardFlags } from '../services/db';
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
    searchProps
  } = useSearch();
  
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
        
        // Синхронизируем флаги мудборда перед загрузкой
        await syncMoodboardFlags();
        
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

  // Убираем поиск по тексту - теперь searchValue используется только для фильтрации меток в SearchDropdown
  // Фильтрация карточек происходит только через selectedTags

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
    console.log('[CardsPage] Клик на кнопку мудборда для карточки:', card.id, 'текущий статус inMoodboard:', card.inMoodboard);
    
    try {
      if (card.inMoodboard) {
        console.log('[CardsPage] Удаляем из мудборда');
        await removeFromMoodboard(card.id);
      } else {
        console.log('[CardsPage] Добавляем в мудборд');
        await addToMoodboard(card.id);
      }
      
      console.log('[CardsPage] Перезагружаем карточки');
      // Перезагружаем карточки для обновления состояния
      const allCards = await getAllCards();
      setCards(allCards);
      
      // Проверяем обновилась ли карточка
      const updatedCard = allCards.find(c => c.id === card.id);
      console.log('[CardsPage] Карточка после обновления:', updatedCard?.id, 'inMoodboard:', updatedCard?.inMoodboard);
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

