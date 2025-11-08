/**
 * Компонент SearchBar - поисковое меню
 * Закреплено вверху, с фильтрацией по меткам и саджестом
 */

import { useState, useRef, useEffect } from 'react';
import { Input } from '../common';
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
}

/**
 * Компонент SearchBar
 */
export const SearchBar = ({
  value = '',
  onChange,
  selectedTags = [],
  onTagsChange
}: SearchBarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(value);
  const searchRef = useRef<HTMLDivElement>(null);

  // Закрытие при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchValue(newValue);
    onChange?.(newValue);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleClear = () => {
    setSearchValue('');
    onChange?.('');
  };

  const handleRemoveTag = (tagId: string) => {
    const newTags = selectedTags.filter(id => id !== tagId);
    onTagsChange?.(newTags);
  };

  const handleClearAll = () => {
    setSearchValue('');
    onChange?.('');
    onTagsChange?.([]);
  };

  return (
    <div className="searchbar" ref={searchRef}>
      <div className="searchbar__container">
        {/* Поле ввода */}
        <div className="searchbar__input-wrapper">
          <Input
            type="search"
            placeholder="Поиск по меткам или ID карточки"
            value={searchValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onClear={handleClear}
            clearable
            fullWidth
            iconLeft={
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
        </div>

        {/* Выбранные метки */}
        {selectedTags.length > 0 && (
          <div className="searchbar__selected-tags">
            {selectedTags.map((tagId) => (
              <div key={tagId} className="searchbar__selected-tag">
                <span className="searchbar__tag-text">Метка {tagId}</span>
                <button
                  className="searchbar__tag-remove"
                  onClick={() => handleRemoveTag(tagId)}
                  aria-label="Удалить метку"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M9 3L3 9M3 3L9 9"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            ))}
            <button
              className="searchbar__clear-all"
              onClick={handleClearAll}
            >
              Очистить всё
            </button>
          </div>
        )}
      </div>

      {/* Выпадающее меню с метками (будет реализовано позже) */}
      {isOpen && (
        <div className="searchbar__dropdown">
          <div className="searchbar__dropdown-content">
            <p className="searchbar__empty-message text-s">
              Меню поиска будет реализовано в следующих этапах.
              <br />
              Здесь будут отображаться категории, метки и история поиска.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBar;

