/**
 * Страница мудборда
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout';
import { useSearch } from '../contexts';
import { Button, Icon } from '../components/common';
import { MasonryGrid, CardViewModal } from '../components/gallery';
import { getCardsByIds, getCard, addToMoodboard, removeFromMoodboard, getMoodboard, clearMoodboard } from '../services/db';
import { logClearMoodboard } from '../services/history';
import { useToast } from '../hooks/useToast';
import { useAlert } from '../hooks/useAlert';
import type { Card, ViewMode, ContentFilter } from '../types';

export const MoodboardPage = () => {
  const navigate = useNavigate();
  const { searchProps, setSelectedTags } = useSearch();
  const toast = useToast();
  const alert = useAlert();
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [moodboardCardIds, setMoodboardCardIds] = useState<string[]>([]);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  
  // Состояние данных
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Модальное окно просмотра
  const [viewingCard, setViewingCard] = useState<Card | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Состояние экспорта
  const [isExporting, setIsExporting] = useState(false);

  // Ref для сохранения позиции скролла
  const scrollPositionRef = useRef<number>(0);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  // Инициализация ref для контейнера скролла
  useEffect(() => {
    scrollContainerRef.current = document.querySelector('.layout__content') as HTMLElement;
  }, []);

  // Загрузка карточек в мудборде
  useEffect(() => {
    const loadMoodboardCards = async () => {
      try {
        setIsLoading(true);
        const moodboard = await getMoodboard();
        // Загружаем карточки мудборда через bulkGet (оптимизированная загрузка)
        const moodboardCards = await getCardsByIds(moodboard.cardIds);
        setCards(moodboardCards);
        setMoodboardCardIds(moodboard.cardIds);
      } catch (error) {
        console.error('Ошибка загрузки мудборда:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMoodboardCards();
  }, []);

  // Восстановление позиции скролла после обновления данных
  useEffect(() => {
    if (!isLoading && scrollContainerRef.current && scrollPositionRef.current > 0) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollPositionRef.current;
            scrollPositionRef.current = 0;
          }
        });
      });
    }
  }, [isLoading, cards]);

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
    setViewingCard(card);
    setIsModalOpen(true);
  };

  // Обработчик закрытия модального окна
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setViewingCard(null);
  };

  // Обработчик обновления карточки
  const handleCardUpdated = async () => {
    try {
      if (!viewingCard) return;
      
      // Загружаем обновленную карточку
      const updatedCard = await getCard(viewingCard.id);
      if (!updatedCard) {
        // Если карточка не найдена, возможно она была удалена
        const moodboard = await getMoodboard();
        const moodboardCards = await getCardsByIds(moodboard.cardIds);
        setCards(moodboardCards);
        setMoodboardCardIds(moodboard.cardIds);
        return;
      }
      
      // Обновляем карточку в списке локально
      setCards(prev => 
        prev.map(c => c.id === updatedCard.id ? updatedCard : c)
      );
      
      // Обновляем viewingCard если она открыта
      setViewingCard(updatedCard);
    } catch (error) {
      console.error('Ошибка обновления состояния после изменения карточки:', error);
      // При ошибке перезагружаем данные
      const moodboard = await getMoodboard();
      const moodboardCards = await getCardsByIds(moodboard.cardIds);
      setCards(moodboardCards);
      setMoodboardCardIds(moodboard.cardIds);
    }
  };

  // Обработчик удаления карточки
  const handleCardDeleted = async () => {
    try {
      if (!viewingCard) return;
      
      // Удаляем карточку из списка локально
      setCards(prev => prev.filter(c => c.id !== viewingCard.id));
      setMoodboardCardIds(prev => prev.filter(id => id !== viewingCard.id));
      
      // Закрываем модальное окно
      setIsModalOpen(false);
      setViewingCard(null);
    } catch (error) {
      console.error('Ошибка обновления состояния после удаления карточки:', error);
      // При ошибке перезагружаем данные
      setIsModalOpen(false);
      setViewingCard(null);
      const moodboard = await getMoodboard();
      const moodboardCards = await getCardsByIds(moodboard.cardIds);
      setCards(moodboardCards);
      setMoodboardCardIds(moodboard.cardIds);
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
    try {
      const isInMoodboard = moodboardCardIds.includes(card.id);
      
      if (isInMoodboard) {
        // Удаляем из мудборда
        await removeFromMoodboard(card.id);
        // Обновляем состояние локально
        setCards(prev => prev.filter(c => c.id !== card.id));
        setMoodboardCardIds(prev => prev.filter(id => id !== card.id));
      } else {
        // Добавляем в мудборд
        await addToMoodboard(card.id);
        // Обновляем состояние локально
        setCards(prev => [...prev, card]);
        setMoodboardCardIds(prev => [...prev, card.id]);
      }
    } catch (error) {
      console.error('Ошибка переключения мудборда:', error);
      // При ошибке перезагружаем данные
      const moodboard = await getMoodboard();
      const moodboardCards = await getCardsByIds(moodboard.cardIds);
      setCards(moodboardCards);
      setMoodboardCardIds(moodboard.cardIds);
    }
  };

  // Обработчик клика на коллекцию
  const handleCollectionClick = (collectionId: string) => {
    setIsModalOpen(false);
    navigate(`/collections/${collectionId}`);
  };

  // Обработчик клика на метку
  const handleTagClick = (tagId: string) => {
    setIsModalOpen(false);
    setSelectedTags([tagId]);
    navigate('/cards');
  };

  // Обработчик экспорта мудборда
  const handleExportMoodboard = async () => {
    if (cards.length === 0) {
      alert.error('Мудборд пуст');
      return;
    }

    if (!window.electronAPI) {
      alert.error('Electron API недоступен');
      return;
    }

    try {
      setIsExporting(true);
      alert.info(`Экспорт ${cards.length} файлов. Это может занять несколько минут...`);

      // 1. Выбираем папку для экспорта
      const targetDir = await window.electronAPI.selectWorkingDirectory();
      
      if (!targetDir) {
        setIsExporting(false);
        return;
      }

      // 2. Собираем пути к файлам
      const filePaths = cards.map(card => card.filePath);

      // 3. Экспортируем файлы
      const result = await window.electronAPI.exportMoodboard(filePaths, targetDir);

      if (result.success) {
        if (result.failedCount > 0) {
          alert.warning(`Экспорт завершён! Скопировано: ${result.copiedCount} из ${cards.length}. Не удалось скопировать: ${result.failedCount} файлов`);
        } else {
          alert.success(`Экспорт завершён! Скопировано: ${result.copiedCount} файлов`);
        }
        
        // Открываем папку с экспортом
        await window.electronAPI.openFileLocation(targetDir);
      } else {
        alert.error('Ошибка экспорта');
      }
    } catch (error) {
      console.error('[Moodboard] Ошибка экспорта:', error);
      alert.error('Ошибка экспорта: ' + (error as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  // Обработчик очистки мудборда
  const handleClearMoodboard = async () => {
    if (cards.length === 0) {
      return;
    }

    toast.showToast({
      title: 'Очистить мудборд',
      message: `Вы уверены что хотите очистить мудборд? Будет удалено из мудборда: ${cards.length} карточек. Сами карточки останутся в системе`,
      type: 'error',
      onConfirm: async () => {
        try {
          // Очищаем мудборд (удаляем все карточки из массива)
          await clearMoodboard();

          console.log(`[Moodboard] Очищено карточек: ${cards.length}`);

          // Логируем очистку мудборда
          await logClearMoodboard();

          // Обновляем список
          setCards([]);
          alert.success('Мудборд очищен');
        } catch (error) {
          console.error('[Moodboard] Ошибка очистки:', error);
          alert.error('Ошибка очистки мудборда');
        }
      },
      confirmText: 'Очистить',
      cancelText: 'Отмена'
    });
  };

  // Состояние загрузки
  if (isLoading) {
    return (
      <Layout
        headerProps={{
          title: 'Мудборд'
        }}
        searchProps={searchProps}
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
            <Button 
              variant="border" 
              size="L"
              iconOnly
              iconLeft={<Icon name="download" size={24} variant="border" />}
              onClick={handleExportMoodboard}
              disabled={isExporting || cards.length === 0}
              title="Выгрузить мудборд"
            />
            <Button 
              variant="border" 
              size="L"
              iconOnly
              iconLeft={<Icon name="trash" size={24} variant="border" />}
              onClick={handleClearMoodboard}
              disabled={cards.length === 0}
              title="Очистить мудборд"
            />
          </>
        )
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
        emptyStateText="Ещё не добавлено ни одной карточки…"
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
        onCollectionClick={handleCollectionClick}
        onTagClick={handleTagClick}
      />
    </Layout>
  );
};

export default MoodboardPage;

