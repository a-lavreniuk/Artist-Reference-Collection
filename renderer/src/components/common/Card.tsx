/**
 * Компонент Card - карточка изображения для галереи
 * Отображает превью с базовой информацией и действиями
 */

import { useState, useEffect, useRef } from 'react';
import type { HTMLAttributes } from 'react';
import type { Card as CardType } from '../../types';
import './Card.css';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'id' | 'onClick' | 'onSelect'> {
  /** Данные карточки */
  card: CardType;
  
  /** Компактный вид */
  compact?: boolean;
  
  /** Выбрана ли карточка */
  selected?: boolean;
  
  /** Обработчик клика */
  onClick?: (card: CardType) => void;
  
  /** Обработчик выбора */
  onSelect?: (card: CardType, selected: boolean) => void;
  
  /** Показывать ли оверлей с действиями */
  showActions?: boolean;
}

/**
 * Компонент Card
 */
export const Card = ({
  card,
  compact = false,
  selected = false,
  onClick,
  onSelect,
  showActions = true,
  className = '',
  ...props
}: CardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Intersection Observer для lazy loading
  useEffect(() => {
    if (!cardRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '200px' // Загружаем за 200px до появления в viewport
      }
    );

    observer.observe(cardRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  const classNames = [
    'card',
    compact && 'card--compact',
    selected && 'card--selected',
    !imageLoaded && 'card--loading',
    imageError && 'card--error',
    className
  ].filter(Boolean).join(' ');

  const handleClick = () => {
    onClick?.(card);
  };

  const handleSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(card, !selected);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(true);
  };

  // Форматирование размера файла
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  return (
    <div
      ref={cardRef}
      className={classNames}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      {...props}
    >
      {/* Скелетон при загрузке */}
      {!imageLoaded && !imageError && (
        <div className="card__skeleton skeleton" />
      )}

      {/* Превью изображения - загружается только когда видимо */}
      {!imageError && isVisible && (
        <img
          src={card.thumbnailUrl || card.filePath}
          alt={card.fileName}
          className="card__image"
          loading="lazy"
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      )}

      {/* Ошибка загрузки */}
      {imageError && (
        <div className="card__error">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M21 19V5C21 3.9 20.1 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19ZM8.5 13.5L11 16.51L14.5 12L19 18H5L8.5 13.5Z"
              fill="currentColor"
              opacity="0.3"
            />
          </svg>
          <p className="card__error-text">Не удалось загрузить</p>
        </div>
      )}

      {/* Оверлей с действиями */}
      {showActions && imageLoaded && (
        <div className="card__overlay">
          {/* Чекбокс выбора */}
          <button
            className={`card__checkbox ${selected ? 'card__checkbox--selected' : ''}`}
            onClick={handleSelectClick}
            aria-label={selected ? 'Снять выделение' : 'Выбрать'}
          >
            {selected && (
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M13 4L6 11L3 8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>

          {/* Иконка типа файла */}
          {card.type === 'video' && (
            <div className="card__type-badge">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M8 5V19L19 12L8 5Z"
                  fill="currentColor"
                />
              </svg>
            </div>
          )}

          {/* Информация о файле */}
          {!compact && (
            <div className="card__info">
              <p className="card__filename">{card.fileName}</p>
              <p className="card__size">{formatFileSize(card.fileSize)}</p>
            </div>
          )}
        </div>
      )}

      {/* Индикатор мудборда */}
      {card.inMoodboard && (
        <div className="card__moodboard-badge" title="В мудборде">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z"
              fill="currentColor"
            />
          </svg>
        </div>
      )}
    </div>
  );
};

export default Card;

