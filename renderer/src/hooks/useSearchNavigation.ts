/**
 * Хук для управления поиском с навигацией на страницу карточек
 * Используется на всех страницах для единообразного поведения
 */

import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Card } from '../types';

/**
 * Хук useSearchNavigation
 * Предоставляет состояние поиска и навигацию на страницу карточек при действиях
 */
export function useSearchNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchValue, setSearchValue] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [viewingCard, setViewingCard] = useState<Card | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Проверка, находимся ли мы на странице карточек
  const isOnCardsPage = location.pathname === '/' || location.pathname === '/cards';

  // Обработчик любого действия в поиске
  const handleSearchAction = useCallback(() => {
    // Если не на странице карточек - переходим туда
    if (!isOnCardsPage) {
      console.log('[Search] Навигация на страницу карточек');
      navigate('/cards');
    }
  }, [isOnCardsPage, navigate]);

  // Обработчик клика по карточке из истории
  const handleCardClick = useCallback((card: Card) => {
    console.log('[Search] Открытие карточки:', card.id);
    setViewingCard(card);
    setIsModalOpen(true);
    
    // Переходим на страницу карточек если не там
    if (!isOnCardsPage) {
      navigate('/cards');
    }
  }, [isOnCardsPage, navigate]);

  // Обработчик закрытия модального окна
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setTimeout(() => setViewingCard(null), 300);
  }, []);

  return {
    // Состояние поиска
    searchValue,
    setSearchValue,
    selectedTags,
    setSelectedTags,
    
    // Состояние модального окна
    viewingCard,
    isModalOpen,
    
    // Обработчики
    handleSearchAction,
    handleCardClick,
    handleCloseModal,
    
    // Props для SearchBar
    searchProps: {
      value: searchValue,
      onChange: setSearchValue,
      selectedTags,
      onTagsChange: setSelectedTags,
      onCardClick: handleCardClick,
      onSearchAction: handleSearchAction
    }
  };
}

export default useSearchNavigation;

