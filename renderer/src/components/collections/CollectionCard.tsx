/**
 * Компонент CollectionCard - карточка коллекции
 * Отображает название и превью (последние 3 добавленные карточки)
 */

import type { HTMLAttributes } from 'react';
import { Icon } from '../common';
import type { Collection } from '../../types';
import './CollectionCard.css';

export interface CollectionCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'id' | 'onClick'> {
  /** Данные коллекции */
  collection: Collection;
  
  /** Количество изображений в коллекции */
  imageCount?: number;
  
  /** Количество видео в коллекции */
  videoCount?: number;
  
  /** Обработчик клика */
  onClick?: (collection: Collection) => void;
}

/**
 * Компонент CollectionCard
 */
export const CollectionCard = ({
  collection,
  imageCount = 0,
  videoCount = 0,
  onClick,
  className = '',
  ...props
}: CollectionCardProps) => {
  const classNames = [
    'collection-card',
    className
  ].filter(Boolean).join(' ');

  const handleClick = () => {
    onClick?.(collection);
  };

  // Получаем последние 3 превью (в обратном порядке - последние добавленные первыми)
  const previews = collection.thumbnails.slice(0, 3);
  const totalCount = imageCount + videoCount;

  return (
    <div
      className={classNames}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      {...props}
    >
      {/* Превью (сетка 3 слота) */}
      <div className="collection-card__preview">
        {totalCount > 0 ? (
          <div className="collection-card__grid">
            {/* Заполняем 3 слота */}
            {[0, 1, 2].map((index) => (
              <div key={index} className="collection-card__grid-item">
                {previews[index] ? (
                  <img
                    src={previews[index]}
                    alt=""
                    className="collection-card__image"
                    loading="lazy"
                  />
                ) : (
                  <div className="collection-card__placeholder" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="collection-card__grid">
            {/* Три серых плейсхолдера */}
            {[0, 1, 2].map((index) => (
              <div key={index} className="collection-card__grid-item">
                <div className="collection-card__placeholder" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Информация */}
      <div className="collection-card__info">
        <h4 className="collection-card__title">{collection.name}</h4>
        
        {/* Статистика: иконки с количеством */}
        {totalCount > 0 && (
          <div className="collection-card__stats">
            {imageCount > 0 && (
              <div className="collection-card__stat">
                <Icon name="image" size={16} variant="border" />
                <span>{imageCount}</span>
              </div>
            )}
            {videoCount > 0 && (
              <div className="collection-card__stat">
                <Icon name="play" size={16} variant="border" />
                <span>{videoCount}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionCard;

