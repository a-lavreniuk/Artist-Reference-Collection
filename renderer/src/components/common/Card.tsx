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
  
  /** Массив ID карточек в мудборде (для определения статуса) */
  moodboardCardIds?: string[];
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
  moodboardCardIds = [],
  className = '',
  ...props
}: CardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  // Показываем blur только если есть blurThumbnailUrl (новые карточки)
  const [showBlur, setShowBlur] = useState(!!card.blurThumbnailUrl);
  const cardRef = useRef<HTMLDivElement>(null);
  const fullImageRef = useRef<HTMLImageElement | null>(null);

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
        rootMargin: '1000px' // Загружаем за 1000px до появления в viewport для плавного скролла
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

  // const handleSelectClick = (e: React.MouseEvent) => {
  //   e.stopPropagation();
  //   onSelect?.(card, !selected);
  // };

  const handleMoodboardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMoodboardToggle?.(card);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    // Если было blur превью, убираем его
    if (showBlur) {
      setShowBlur(false);
    }
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(true);
    setShowBlur(false);
  };

  // Определяем URL превью в зависимости от режима и доступности
  const getThumbnailUrl = () => {
    // Приоритет: новый формат с разными размерами
    if (compact && card.thumbnailUrlCompact) {
      return card.thumbnailUrlCompact;
    }
    if (!compact && card.thumbnailUrlStandard) {
      return card.thumbnailUrlStandard;
    }
    // Fallback на legacy thumbnailUrl
    if (card.thumbnailUrl) {
      return card.thumbnailUrl;
    }
    // Последний fallback на оригинальный файл
    return card.filePath;
  };

  // Загружаем полное изображение в фоне после загрузки blur
  useEffect(() => {
    if (!isVisible || imageError) {
      return;
    }

    // Если нет blur превью (старые карточки), сразу показываем полное изображение
    if (!card.blurThumbnailUrl) {
      setShowBlur(false);
      return;
    }

    const fullUrl = getThumbnailUrl();
    if (fullUrl === card.blurThumbnailUrl) {
      // Если blur это единственное доступное превью, не заменяем
      setShowBlur(false);
      return;
    }

    // Предзагружаем полное изображение
    const fullImg = new Image();
    fullImg.src = fullUrl;
    
    fullImg.onload = () => {
      setShowBlur(false);
      setImageLoaded(true);
    };
    
    fullImg.onerror = () => {
      // Если полное изображение не загрузилось, оставляем blur
      setShowBlur(false);
      setImageError(true);
      setImageLoaded(true);
    };

    fullImageRef.current = fullImg;

    return () => {
      if (fullImageRef.current) {
        fullImageRef.current.onload = null;
        fullImageRef.current.onerror = null;
      }
    };
  }, [isVisible, card.blurThumbnailUrl, card.thumbnailUrlCompact, card.thumbnailUrlStandard, card.thumbnailUrl, compact, imageError]);

  // Форматирование размера файла
  // const formatFileSize = (bytes: number): string => {
  //   if (bytes < 1024) return `${bytes} B`;
  //   if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  //   if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  //   return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  // };

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
        <>
          {/* Blur превью (показывается сначала) */}
          {showBlur && card.blurThumbnailUrl && (
            <img
              src={card.blurThumbnailUrl}
              alt=""
              className="card__image card__image--blur"
              loading="eager"
              aria-hidden="true"
            />
          )}
          
          {/* Полное превью (заменяет blur когда загрузится, или показывается сразу если нет blur) */}
          <img
            src={getThumbnailUrl()}
            alt={card.fileName}
            className="card__image"
            loading="lazy"
            fetchPriority={isVisible ? 'high' : 'low'}
            style={{ 
              position: (showBlur && card.blurThumbnailUrl) ? 'absolute' : 'relative',
              zIndex: (showBlur && card.blurThumbnailUrl) ? 1 : 0,
              opacity: (showBlur && card.blurThumbnailUrl) ? 0 : 1,
              transition: 'opacity 0.3s ease-in-out'
            }}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        </>
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
      {showActions && (() => {
        const isInMoodboard = moodboardCardIds.includes(card.id);
        return (
          <button
            className={`card__moodboard-button ${isInMoodboard ? 'card__moodboard-button--active' : ''}`}
            onClick={handleMoodboardClick}
            aria-label={isInMoodboard ? 'Удалить из мудборда' : 'Добавить в мудборд'}
            title={isInMoodboard ? 'Удалить из мудборда' : 'Добавить в мудборд'}
          >
            <Icon 
              name={isInMoodboard ? 'bookmark-minus' : 'bookmark-plus'} 
              size={16}
              variant="border"
            />
          </button>
        );
      })()}
    </div>
  );
};

export default Card;

