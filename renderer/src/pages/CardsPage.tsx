/**
 * Страница карточек - главная страница приложения
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout';
import { MasonryGrid, CardViewModal } from '../components/gallery';
import { getCardsPaginated, getCardsCount, getCardsCountByType, getCard, addToMoodboard, removeFromMoodboard, getMoodboard, searchCardsAdvanced, getCardsByTags, getCardsByType } from '../services/db';
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
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [moodboardCardIds, setMoodboardCardIds] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<Card[] | null>(null);
  
  // Реальное количество карточек в базе данных (для отображения счетчиков)
  const [totalCounts, setTotalCounts] = useState({ images: 0, videos: 0, total: 0 });
  
  // Константы пагинации
  const PAGE_SIZE = 100;
  
  // Кеш загруженных страниц карточек
  const cardsCacheRef = useRef<Map<number, Card[]>>(new Map());

  // Загрузка карточек при монтировании
  useEffect(() => {
    const loadCards = async () => {
      try {
        setIsLoading(true);
        setCards([]);
        setHasMore(true);
        cardsCacheRef.current.clear(); // Очищаем кеш при перезагрузке
        
        // Загружаем первую порцию карточек и общую статистику
        const [firstPage, moodboard, counts] = await Promise.all([
          getCardsPaginated(0, PAGE_SIZE),
          getMoodboard(),
          getCardsCountByType()
        ]);
        
        // Сохраняем в кеш
        cardsCacheRef.current.set(0, firstPage);
        
        setCards(firstPage);
        setMoodboardCardIds(moodboard.cardIds);
        setTotalCounts(counts);
        
        // Проверяем есть ли еще карточки
        setHasMore(firstPage.length < counts.total);
      } finally {
        setIsLoading(false);
      }
    };

    loadCards();
  }, []);

  // Функция загрузки следующей порции карточек
  const loadMoreCards = async () => {
    // Не загружаем если уже загружаем, нет больше карточек, или идет поиск
    if (isLoadingMore || !hasMore || searchResults !== null) {
      return;
    }

    try {
      setIsLoadingMore(true);
      
      const pageIndex = Math.floor(cards.length / PAGE_SIZE);
      
      // Проверяем кеш
      if (cardsCacheRef.current.has(pageIndex)) {
        const cachedPage = cardsCacheRef.current.get(pageIndex)!;
        setCards(prev => [...prev, ...cachedPage]);
        
        const totalCount = await getCardsCount();
        setHasMore(cards.length + cachedPage.length < totalCount);
        setIsLoadingMore(false);
        return;
      }
      
      const nextPage = await getCardsPaginated(cards.length, PAGE_SIZE);
      
      if (nextPage.length > 0) {
        // Сохраняем в кеш
        cardsCacheRef.current.set(pageIndex, nextPage);
        
        setCards(prev => [...prev, ...nextPage]);
        
        // Проверяем есть ли еще карточки
        const totalCount = await getCardsCount();
        setHasMore(cards.length + nextPage.length < totalCount);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Ошибка загрузки дополнительных карточек:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Поиск по ID, меткам или типу контента при изменении searchValue, selectedTags или contentFilter
  useEffect(() => {
    const performSearch = async () => {
      // Если есть выбранные метки, загружаем карточки с этими метками из БД
      if (selectedTags.length > 0) {
        try {
          const results = await getCardsByTags(selectedTags);
          setSearchResults(results);
          console.log('[CardsPage] Поиск по меткам:', selectedTags, 'найдено:', results.length);
        } catch (error) {
          console.error('[CardsPage] Ошибка поиска по меткам:', error);
          setSearchResults(null);
        }
      }
      // Иначе если есть текстовый поиск, используем searchCardsAdvanced
      else if (searchValue && searchValue.trim()) {
        try {
          const results = await searchCardsAdvanced(searchValue.trim());
          setSearchResults(results);
          console.log('[CardsPage] Поиск по запросу:', searchValue, 'найдено:', results.length);
        } catch (error) {
          console.error('[CardsPage] Ошибка поиска:', error);
          setSearchResults(null);
        }
      }
      // Иначе если выбран фильтр по типу контента (не 'all'), загружаем карточки этого типа из БД
      else if (contentFilter !== 'all') {
        try {
          const type = contentFilter === 'images' ? 'image' : 'video';
          const results = await getCardsByType(type);
          setSearchResults(results);
          console.log('[CardsPage] Фильтр по типу:', type, 'найдено:', results.length);
        } catch (error) {
          console.error('[CardsPage] Ошибка фильтрации по типу:', error);
          setSearchResults(null);
        }
      }
      // Иначе сбрасываем результаты поиска (показываем все карточки с пагинацией)
      else {
        setSearchResults(null);
      }
    };

    // Debounce для поиска (300мс)
    const timeoutId = setTimeout(performSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [searchValue, selectedTags, contentFilter]);

  // Фильтрация карточек
  const filteredCards = useMemo(() => {
    // Если есть результаты поиска/фильтрации - используем их, иначе все карточки
    let filtered = searchResults !== null ? [...searchResults] : [...cards];

    // Фильтр по типу контента и меткам уже применен в useEffect
    // через getCardsByType и getCardsByTags, поэтому здесь не нужно фильтровать повторно

    // Сортировка по дате добавления (новые сверху)
    filtered.sort((a, b) => 
      new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
    );

    return filtered;
  }, [cards, searchResults]);

  // Подсчёт карточек по типам - используем реальные данные из БД
  const counts = useMemo(() => {
    return {
      all: totalCounts.total,
      images: totalCounts.images,
      videos: totalCounts.videos
    };
  }, [totalCounts]);

  // Обработчик клика по карточке из галереи
  const handleCardClick = (card: Card) => {
    handleSearchCardClick(card);
  };

  // Обработчик обновления карточки
  const handleCardUpdated = async () => {
    try {
      if (!viewingCard) return;
      
      // Загружаем обновленную карточку
      const updatedCard = await getCard(viewingCard.id);
      if (!updatedCard) {
        // Если карточка не найдена, возможно она была удалена
        cardsCacheRef.current.clear();
        const [firstPage, counts] = await Promise.all([
          getCardsPaginated(0, PAGE_SIZE),
          getCardsCountByType()
        ]);
        cardsCacheRef.current.set(0, firstPage);
        setCards(firstPage);
        setTotalCounts(counts);
        return;
      }
      
      // Обновляем карточку в текущем списке локально
      setCards(prev => 
        prev.map(c => c.id === updatedCard.id ? updatedCard : c)
      );
      
      // Обновляем карточку в кеше если она там есть
      for (const [pageIndex, pageCards] of cardsCacheRef.current.entries()) {
        const cardIndex = pageCards.findIndex(c => c.id === updatedCard.id);
        if (cardIndex !== -1) {
          const updatedPageCards = [...pageCards];
          updatedPageCards[cardIndex] = updatedCard;
          cardsCacheRef.current.set(pageIndex, updatedPageCards);
          break;
        }
      }
      
      // Обновляем viewingCard если она открыта
      updateViewingCard(updatedCard);
      
      // Обновляем счетчики на случай если изменился тип карточки (маловероятно, но возможно)
      const counts = await getCardsCountByType();
      setTotalCounts(counts);
    } catch (error) {
      console.error('Ошибка обновления состояния после изменения карточки:', error);
      // При ошибке перезагружаем данные
      cardsCacheRef.current.clear();
      const [firstPage, counts] = await Promise.all([
        getCardsPaginated(0, PAGE_SIZE),
        getCardsCountByType()
      ]);
      cardsCacheRef.current.set(0, firstPage);
      setCards(firstPage);
      setTotalCounts(counts);
    }
  };

  // Обработчик удаления карточки
  const handleCardDeleted = async () => {
    try {
      if (!viewingCard) return;
      
      // Удаляем карточку из текущего списка локально
      setCards(prev => prev.filter(c => c.id !== viewingCard.id));
      
      // Удаляем карточку из кеша если она там есть
      for (const [pageIndex, pageCards] of cardsCacheRef.current.entries()) {
        const cardIndex = pageCards.findIndex(c => c.id === viewingCard.id);
        if (cardIndex !== -1) {
          const updatedPageCards = pageCards.filter(c => c.id !== viewingCard.id);
          cardsCacheRef.current.set(pageIndex, updatedPageCards);
          break;
        }
      }
      
      // Обновляем счетчики после удаления
      const counts = await getCardsCountByType();
      setTotalCounts(counts);
      
      // Закрываем модальное окно
      handleCloseModal();
    } catch (error) {
      console.error('Ошибка обновления состояния после удаления карточки:', error);
      // При ошибке перезагружаем данные
      cardsCacheRef.current.clear();
      const [firstPage, counts] = await Promise.all([
        getCardsPaginated(0, PAGE_SIZE),
        getCardsCountByType()
      ]);
      cardsCacheRef.current.set(0, firstPage);
      setCards(firstPage);
      setTotalCounts(counts);
      handleCloseModal();
    }
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
      // Инвалидируем кеш и перезагружаем первую страницу
      cardsCacheRef.current.clear();
      const [firstPage, moodboard, counts] = await Promise.all([
        getCardsPaginated(0, PAGE_SIZE),
        getMoodboard(),
        getCardsCountByType()
      ]);
      cardsCacheRef.current.set(0, firstPage);
      setCards(firstPage);
      setMoodboardCardIds(moodboard.cardIds);
      setTotalCounts(counts);
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
        onLoadMore={searchResults === null && contentFilter === 'all' ? loadMoreCards : undefined}
        hasMore={hasMore && searchResults === null && contentFilter === 'all'}
        isLoadingMore={isLoadingMore}
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

