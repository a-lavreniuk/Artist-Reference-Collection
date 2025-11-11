/**
 * Компонент Card - карточка изображения для галереи
 * Отображает превью с базовой информацией и действиями
 */

import { useState, useEffect, useRef } from 'react';
import type { HTMLAttributes } from 'react';
import { Icon } from './Icon';
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
  
  /** Обработчик добавления/удаления из мудборда */
  onMoodboardToggle?: (card: CardType) => void;
  
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
  onMoodboardToggle,
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

  const handleMoodboardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMoodboardToggle?.(card);
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
          <div style={{ width: 48, height: 48, opacity: 0.3 }}>
            <Icon name="image" size={24} variant="fill" style={{ width: 48, height: 48 }} />
          </div>
          <p className="card__error-text">Не удалось загрузить</p>
        </div>
      )}

      {/* Иконка типа файла - всегда видна */}
      {imageLoaded && (
        <div className="card__type-badge">
          <Icon 
            name={card.type === 'video' ? 'play' : 'image'} 
            size={16}
            variant="border"
          />
        </div>
      )}

      {/* Кнопка мудборда - появляется при ховере */}
      {showActions && (
        <button
          className={`card__moodboard-button ${card.inMoodboard ? 'card__moodboard-button--active' : ''}`}
          onClick={handleMoodboardClick}
          aria-label={card.inMoodboard ? 'Удалить из мудборда' : 'Добавить в мудборд'}
          title={card.inMoodboard ? 'Удалить из мудборда' : 'Добавить в мудборд'}
        >
          <Icon 
            name={card.inMoodboard ? 'bookmark-minus' : 'bookmark-plus'} 
            size={16}
            variant="border"
          />
        </button>
      )}
    </div>
  );
};

export default Card;

