/**
 * Компонент CollectionCard - карточка коллекции
 * Отображает название, описание и превью (первые 4 изображения)
 */

import { HTMLAttributes } from 'react';
import type { Collection } from '../../types';
import './CollectionCard.css';

export interface CollectionCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'id'> {
  /** Данные коллекции */
  collection: Collection;
  
  /** Обработчик клика */
  onClick?: (collection: Collection) => void;
}

/**
 * Компонент CollectionCard
 */
export const CollectionCard = ({
  collection,
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

  // Получаем первые 4 превью
  const previews = collection.thumbnails.slice(0, 4);
  const cardCount = collection.cardIds.length;

  return (
    <div
      className={classNames}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      {...props}
    >
      {/* Превью (сетка 2x2) */}
      <div className="collection-card__preview">
        {previews.length > 0 ? (
          <div className={`collection-card__grid collection-card__grid--${previews.length}`}>
            {previews.map((url, index) => (
              <div key={index} className="collection-card__grid-item">
                <img
                  src={url}
                  alt=""
                  className="collection-card__image"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="collection-card__empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <path
                d="M20 6H12L10 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V8C22 6.9 21.1 6 20 6Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-s">Пусто</p>
          </div>
        )}
        
        {/* Счётчик карточек */}
        <div className="collection-card__count">
          <span>{cardCount}</span>
        </div>
      </div>

      {/* Информация */}
      <div className="collection-card__info">
        <h4 className="collection-card__title">{collection.name}</h4>
        {collection.description && (
          <p className="collection-card__description text-s">
            {collection.description}
          </p>
        )}
      </div>
    </div>
  );
};

export default CollectionCard;

