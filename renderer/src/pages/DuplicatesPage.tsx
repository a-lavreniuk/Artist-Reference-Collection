/**
 * Страница поиска дублей изображений
 * Позволяет находить и удалять дубликаты по содержимому изображений
 */

import { useState } from 'react';
import { Layout } from '../components/layout';
import { Button, Icon } from '../components/common';
import { useSearch } from '../contexts';
import { useToast } from '../hooks/useToast';
import { getAllCards } from '../services/db';
import { findDuplicates, skipDuplicatePair, clearSkippedPairs, type DuplicatePair } from '../services/duplicateService';
import { DuplicateComparison } from '../components/duplicates/DuplicateComparison';
import './DuplicatesPage.css';

export const DuplicatesPage = () => {
  const { searchProps } = useSearch();
  const toast = useToast();
  
  const [isSearching, setIsSearching] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchProgress, setSearchProgress] = useState<{ current: number; total: number } | null>(null);

  /**
   * Поиск дублей в базе данных
   */
  const handleFindDuplicates = async () => {
    try {
      setIsSearching(true);
      setDuplicates([]);
      setCurrentIndex(0);
      setSearchProgress(null);

      // Загружаем все карточки с изображениями
      const allCards = await getAllCards();
      const imageCards = allCards.filter(card => card.type === 'image');

      if (imageCards.length < 2) {
        toast.info('Недостаточно изображений для поиска дублей. Необходимо минимум 2 изображения.');
        return;
      }

      // Ищем дубли (порог схожести 85%, с поддержкой поворотов)
      const foundDuplicates = await findDuplicates(
        imageCards, 
        85, 
        true, 
        (current, total) => {
          setSearchProgress({ current, total });
        }
      );
      
      setDuplicates(foundDuplicates);
      setSearchProgress(null);
      
      if (foundDuplicates.length === 0) {
        toast.success('Дубликаты не найдены! Ваша коллекция уникальна.');
      } else {
        toast.success(`Найдено ${foundDuplicates.length} ${foundDuplicates.length === 1 ? 'дубликат' : 'дубликатов'}`);
      }
    } catch (error) {
      console.error('Ошибка поиска дублей:', error);
      toast.error('Не удалось выполнить поиск дублей. Попробуйте снова.');
      setSearchProgress(null);
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * Пропустить текущую пару дублей
   */
  const handleSkip = () => {
    const currentDup = duplicates[currentIndex];
    if (currentDup) {
      // Сохраняем пропущенную пару в localStorage
      skipDuplicatePair(currentDup.card1.id, currentDup.card2.id);
    }

    if (currentIndex < duplicates.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Больше нет дублей
      setDuplicates([]);
      setCurrentIndex(0);
    }
  };

  /**
   * Очистить список пропущенных пар
   */
  const handleClearSkipped = () => {
    toast.showToast({
      title: 'Очистить пропущенные',
      message: 'Очистить список пропущенных пар? Они снова будут показываться при поиске дублей.',
      type: 'info',
      onConfirm: () => {
        clearSkippedPairs();
        toast.success('Список пропущенных пар очищен');
      },
      confirmText: 'Очистить',
      cancelText: 'Отмена'
    });
  };

  /**
   * Удалить выбранную карточку
   */
  const handleDelete = async (cardId: string) => {
    try {
      setIsDeleting(true);
      
      // Импортируем функцию удаления
      const { deleteCard } = await import('../services/db');
      await deleteCard(cardId);

      // Удаляем пару из списка дублей
      const newDuplicates = duplicates.filter((dup, index) => {
        if (index === currentIndex) {
          // Удаляем текущую пару, так как один из файлов удален
          return false;
        }
        // Удаляем пару если она содержит удаленную карточку
        return dup.card1.id !== cardId && dup.card2.id !== cardId;
      });

      setDuplicates(newDuplicates);

      if (newDuplicates.length === 0) {
        // Больше нет дублей
        setCurrentIndex(0);
      } else if (currentIndex >= newDuplicates.length) {
        // Если текущий индекс выходит за границы, переходим к последнему
        setCurrentIndex(newDuplicates.length - 1);
      }
    } catch (error) {
      console.error('Ошибка удаления карточки:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const currentDuplicate = duplicates[currentIndex];
  const hasDuplicates = duplicates.length > 0;

  return (
    <Layout
      headerProps={{
        title: 'Поиск дублей',
        actions: (
          <div className="duplicates-page__actions">
            <Button
              variant="border"
              size="L"
              iconOnly
              iconLeft={<Icon name="trash" size={24} variant="border" />}
              onClick={handleClearSkipped}
              disabled={isSearching || isDeleting}
              title="Очистить пропущенные пары"
            />
            <Button
              variant="primary"
              size="L"
              iconLeft={<Icon name="copy" size={24} variant="border" />}
              onClick={handleFindDuplicates}
              loading={isSearching}
              disabled={isSearching || isDeleting}
            >
              Найти дубли
            </Button>
            {hasDuplicates && (
              <Button
                variant="secondary"
                size="L"
                onClick={handleSkip}
                disabled={isDeleting}
              >
                Пропустить
              </Button>
            )}
          </div>
        )
      }}
      searchProps={searchProps}
    >
      <div className="duplicates-page">
        {!hasDuplicates && !isSearching && (
          <div className="layout__empty-state">
            <h3 className="layout__empty-title">Дубли не найдены</h3>
            <p className="layout__empty-text text-m">
              Нажмите кнопку «Найти дубли» для поиска дубликатов изображений в вашей коллекции
            </p>
          </div>
        )}

        {isSearching && (
          <div className="layout__empty-state">
            <h3 className="layout__empty-title">Поиск дублей...</h3>
            <p className="layout__empty-text text-m">
              {searchProgress 
                ? `Обработано: ${searchProgress.current.toLocaleString()} из ${searchProgress.total.toLocaleString()}`
                : 'Это может занять некоторое время'}
            </p>
          </div>
        )}

        {hasDuplicates && currentDuplicate && (
          <DuplicateComparison
            card1={currentDuplicate.card1}
            card2={currentDuplicate.card2}
            similarity={currentDuplicate.similarity}
            method={currentDuplicate.method}
            onDelete={handleDelete}
            isDeleting={isDeleting}
            currentIndex={currentIndex + 1}
            totalCount={duplicates.length}
          />
        )}
      </div>
    </Layout>
  );
};

export default DuplicatesPage;

