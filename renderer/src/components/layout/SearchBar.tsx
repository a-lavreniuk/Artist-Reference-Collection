/**
 * Компонент SearchBar - поисковое меню
 * Закреплено вверху, с фильтрацией по меткам и саджестом
 */

import { useState, useRef, useEffect } from 'react';
import { Input, Icon } from '../common';
import { SearchDropdown } from './SearchDropdown';
import { addSearchHistory, getAllTags } from '../../services/db';
import type { Tag, Card } from '../../types';
import './SearchBar.css';

export interface SearchBarProps {
  /** Текущий поисковый запрос */
  value?: string;
  
  /** Обработчик изменения поискового запроса */
  onChange?: (value: string) => void;
  
  /** Выбранные метки */
  selectedTags?: string[];
  
  /** Обработчик выбора меток */
  onTagsChange?: (tags: string[]) => void;
  
  /** Обработчик клика по карточке из истории */
  onCardClick?: (card: Card) => void;
  
  /** Обработчик любого действия в поиске (для навигации на страницу карточек) */
  onSearchAction?: () => void;
  
  /** Состояние открытости меню (из глобального контекста) */
  isMenuOpen?: boolean;
  
  /** Обработчик изменения состояния меню */
  setIsMenuOpen?: (isOpen: boolean) => void;
}

/**
 * Компонент SearchBar
 */
export const SearchBar = ({
  value = '',
  onChange,
  selectedTags = [],
  onTagsChange,
  onCardClick,
  onSearchAction,
  isMenuOpen = false,
  setIsMenuOpen
}: SearchBarProps) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Используем значение из пропсов (из глобального контекста)
  const searchValue = value || '';
  const isOpen = isMenuOpen;

  // Загрузка меток для отображения названий
  useEffect(() => {
    const loadTags = async () => {
      try {
        const allTags = await getAllTags();
        setTags(allTags);
      } catch (error) {
        console.error('[SearchBar] Ошибка загрузки меток:', error);
      }
    };

    loadTags();
  }, []);

  // Закрытие при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsMenuOpen?.(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsMenuOpen]);

  // Сохранение фокуса при навигации
  useEffect(() => {
    // Если меню открыто и есть текст в поиске, восстанавливаем фокус
    if (isOpen && searchValue) {
      // Небольшая задержка чтобы дождаться завершения навигации
      const timeoutId = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, searchValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange?.(newValue);
    
    // Открываем выпадающее меню при вводе
    if (!isOpen) {
      setIsMenuOpen?.(true);
    }
    
    // Если начался ввод - вызываем навигацию
    if (newValue.trim()) {
      onSearchAction?.();
    }
  };

  const handleInputFocus = () => {
    setIsMenuOpen?.(true);
  };

  const handleClear = () => {
    onChange?.('');
  };

  const handleRemoveTag = (tagId: string) => {
    const newTags = selectedTags.filter(id => id !== tagId);
    onTagsChange?.(newTags);
  };

  const handleClearAll = async () => {
    onChange?.('');
    onTagsChange?.([]);
    
    // Сохраняем в историю если были метки
    if (selectedTags.length > 0) {
      try {
        await addSearchHistory('', selectedTags);
      } catch (error) {
        console.error('[SearchBar] Ошибка сохранения истории:', error);
      }
    }
  };

  // Обработчик выбора метки из выпадающего меню
  const handleTagSelect = (tagId: string) => {
    // Вызываем навигацию на страницу карточек
    onSearchAction?.();
    
    if (selectedTags.includes(tagId)) {
      // Убираем метку
      handleRemoveTag(tagId);
    } else {
      // Добавляем метку
      const newTags = [...selectedTags, tagId];
      onTagsChange?.(newTags);
      
      // Сохраняем в историю
      addSearchHistory(searchValue, newTags).catch(error => {
        console.error('[SearchBar] Ошибка сохранения истории:', error);
      });
    }
  };

  // Обработчик выбора меток из истории
  const handleHistoryTagSelect = (tagIds: string[]) => {
    // Вызываем навигацию на страницу карточек
    onSearchAction?.();
    
    // Очищаем поисковый запрос и устанавливаем метки
    onChange?.('');
    onTagsChange?.(tagIds);
    setIsMenuOpen?.(false);
  };

  // Обработчик клика по недавно просмотренной карточке
  const handleRecentCardClick = (card: Card) => {
    // Вызываем навигацию на страницу карточек
    onSearchAction?.();
    
    // Закрываем меню
    setIsMenuOpen?.(false);
    // Открываем карточку
    onCardClick?.(card);
  };

  // Получить название метки по ID
  const getTagName = (tagId: string): string => {
    const tag = tags.find(t => t.id === tagId);
    return tag?.name || `Метка ${tagId}`;
  };

  return (
    <div className="searchbar" ref={searchRef}>
      <div className="searchbar__container">
        {/* Поле ввода */}
        <div className="searchbar__input-wrapper">
          <Input
            ref={inputRef}
            type="search"
            placeholder="Поиск по меткам или ID карточки"
            value={searchValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onClear={handleClear}
            clearable
            fullWidth
            iconLeft={<Icon name="search" size={24} variant="border" />}
          />
        </div>

        {/* Выбранные метки */}
        {selectedTags.length > 0 && (
          <div className="searchbar__selected-tags">
            <button
              className="searchbar__clear-all"
              onClick={handleClearAll}
              aria-label="Очистить всё"
            >
              <Icon name="x" size={16} variant="border" />
            </button>
            {selectedTags.map((tagId) => (
              <button
                key={tagId}
                className="searchbar__selected-tag"
                onClick={() => handleRemoveTag(tagId)}
                aria-label={`Удалить метку ${getTagName(tagId)}`}
              >
                <span className="searchbar__tag-text">{getTagName(tagId)}</span>
                <Icon name="x" size={16} variant="border" className="searchbar__tag-icon" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Выпадающее меню с метками */}
      <SearchDropdown
        searchQuery={searchValue}
        selectedTags={selectedTags}
        onTagSelect={handleTagSelect}
        onHistoryTagSelect={handleHistoryTagSelect}
        onRecentCardClick={handleRecentCardClick}
        isVisible={isOpen}
        onClose={() => setIsMenuOpen?.(false)}
      />
    </div>
  );
};

export default SearchBar;

