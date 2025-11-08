/**
 * Страница мудборда
 */

import { useState, useEffect, useMemo } from 'react';
import { Layout } from '../components/layout';
import { Button } from '../components/common';
import { MasonryGrid, CardViewModal } from '../components/gallery';
import { getAllCards, updateCard } from '../services/db';
import type { Card, ViewMode, ContentFilter } from '../types';

export const MoodboardPage = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  
  // Состояние данных
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Модальное окно просмотра
  const [viewingCard, setViewingCard] = useState<Card | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Состояние экспорта
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

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

    // Подписываемся на прогресс экспорта
    if (window.electronAPI?.onExportProgress) {
      window.electronAPI.onExportProgress((data) => {
        setExportProgress(data.percent);
      });
    }
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
    // Перезагружаем карточки после обновления
    const allCards = await getAllCards();
    const moodboardCards = allCards.filter(card => card.inMoodboard);
    setCards(moodboardCards);
    
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
    setIsModalOpen(false);
    setViewingCard(null);
    // Перезагружаем список
    const allCards = await getAllCards();
    const moodboardCards = allCards.filter(card => card.inMoodboard);
    setCards(moodboardCards);
  };

  // Обработчик выбора карточки
  const handleCardSelect = (card: Card, selected: boolean) => {
    if (selected) {
      setSelectedCards(prev => [...prev, card.id]);
    } else {
      setSelectedCards(prev => prev.filter(id => id !== card.id));
    }
  };

  // Обработчик экспорта мудборда
  const handleExportMoodboard = async () => {
    if (cards.length === 0) {
      setExportMessage('❌ Мудборд пуст');
      setTimeout(() => setExportMessage(null), 2000);
      return;
    }

    if (!window.electronAPI) {
      setExportMessage('❌ Electron API недоступен');
      return;
    }

    try {
      setIsExporting(true);
      setExportProgress(0);
      setExportMessage('🔄 Выбор папки для экспорта...');

      // 1. Выбираем папку для экспорта
      const targetDir = await window.electronAPI.selectWorkingDirectory();
      
      if (!targetDir) {
        setIsExporting(false);
        setExportMessage(null);
        return;
      }

      setExportMessage(`🔄 Экспорт ${cards.length} файлов...`);

      // 2. Собираем пути к файлам
      const filePaths = cards.map(card => card.filePath);

      // 3. Экспортируем файлы
      const result = await window.electronAPI.exportMoodboard(filePaths, targetDir);

      if (result.success) {
        setExportMessage(`✅ Экспорт завершён! Скопировано: ${result.copiedCount} из ${cards.length}`);
        
        if (result.failedCount > 0) {
          setExportMessage(prev => prev + `\n⚠️ Не удалось скопировать: ${result.failedCount} файлов`);
        }

        // Открываем папку с экспортом
        await window.electronAPI.openFileLocation(targetDir);
        
        setTimeout(() => setExportMessage(null), 5000);
      } else {
        setExportMessage('❌ Ошибка экспорта');
      }
    } catch (error) {
      console.error('[Moodboard] Ошибка экспорта:', error);
      setExportMessage('❌ Ошибка экспорта: ' + (error as Error).message);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  // Обработчик очистки мудборда
  const handleClearMoodboard = async () => {
    if (cards.length === 0) {
      return;
    }

    const confirmed = confirm(
      `Очистить мудборд?\n\n` +
      `Будет удалено из мудборда: ${cards.length} карточек\n\n` +
      `⚠️ Сами карточки НЕ будут удалены, только убраны из мудборда.\n\n` +
      `Продолжить?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setExportMessage('🔄 Очистка мудборда...');

      // Снимаем флаг inMoodboard со всех карточек
      for (const card of cards) {
        await updateCard(card.id, { inMoodboard: false });
      }

      console.log(`[Moodboard] Очищено карточек: ${cards.length}`);

      // Обновляем список
      setCards([]);
      setExportMessage('✅ Мудборд очищен');
      setTimeout(() => setExportMessage(null), 2000);
    } catch (error) {
      console.error('[Moodboard] Ошибка очистки:', error);
      setExportMessage('❌ Ошибка очистки мудборда');
      setTimeout(() => setExportMessage(null), 3000);
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
            <Button 
              variant="secondary" 
              size="medium"
              onClick={handleExportMoodboard}
              disabled={isExporting || cards.length === 0}
            >
              {isExporting ? 'Экспорт...' : 'Выгрузить мудборд'}
            </Button>
            <Button 
              variant="danger" 
              size="medium"
              onClick={handleClearMoodboard}
              disabled={cards.length === 0}
            >
              Очистить мудборд
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

      {/* Прогресс экспорта */}
      {isExporting && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '320px',
          padding: '16px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-l)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 100
        }}>
          <p className="text-s" style={{ marginBottom: '12px', fontWeight: 'var(--font-weight-bold)' }}>
            Экспорт мудборда
          </p>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: 'var(--color-grayscale-200)',
            borderRadius: 'var(--radius-s)',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${exportProgress}%`,
              height: '100%',
              backgroundColor: 'var(--bg-button-primary)',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <p className="text-s" style={{ marginTop: '8px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            {exportProgress}%
          </p>
        </div>
      )}

      {/* Сообщение о экспорте */}
      {exportMessage && !isExporting && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '320px',
          padding: '16px',
          backgroundColor: exportMessage.includes('✅') ? 'var(--color-green-100)' : exportMessage.includes('⚠️') ? 'var(--color-yellow-100)' : 'var(--color-red-100)',
          borderRadius: 'var(--radius-l)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 100,
          whiteSpace: 'pre-line'
        }}>
          <p className="text-s">{exportMessage}</p>
        </div>
      )}

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

export default MoodboardPage;

