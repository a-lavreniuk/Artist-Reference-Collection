/**
 * Контекст для управления глобальным состоянием поиска
 * Сохраняет состояние поиска при навигации между страницами
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Card } from '../types';

interface SearchContextType {
  // Состояние поиска
  searchValue: string;
  setSearchValue: (value: string) => void;
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  
  // Состояние модального окна
  viewingCard: Card | null;
  isModalOpen: boolean;
  
  // Обработчики
  handleSearchAction: () => void;
  handleCardClick: (card: Card) => void;
  handleCloseModal: () => void;
  
  // Props для SearchBar
  searchProps: {
    value: string;
    onChange: (value: string) => void;
    selectedTags: string[];
    onTagsChange: (tags: string[]) => void;
    onCardClick: (card: Card) => void;
    onSearchAction: () => void;
  };
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

/**
 * Provider для контекста поиска
 */
export function SearchProvider({ children }: { children: ReactNode }) {
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

  const value: SearchContextType = {
    searchValue,
    setSearchValue,
    selectedTags,
    setSelectedTags,
    viewingCard,
    isModalOpen,
    handleSearchAction,
    handleCardClick,
    handleCloseModal,
    searchProps: {
      value: searchValue,
      onChange: setSearchValue,
      selectedTags,
      onTagsChange: setSelectedTags,
      onCardClick: handleCardClick,
      onSearchAction: handleSearchAction
    }
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}

/**
 * Хук для использования контекста поиска
 */
export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch должен использоваться внутри SearchProvider');
  }
  return context;
}

export default SearchContext;

