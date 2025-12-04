/**
 * Компонент CardSkeleton - скелетон для карточки в процессе загрузки
 * Отображает placeholder точно такого же размера как карточка
 */

import './CardSkeleton.css';

export interface CardSkeletonProps {
  /** Компактный вид */
  compact?: boolean;
}

/**
 * Компонент CardSkeleton
 */
export const CardSkeleton = ({ compact = false }: CardSkeletonProps) => {
  const classNames = [
    'card-skeleton',
    compact && 'card-skeleton--compact'
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames}>
      <div className="card-skeleton__image skeleton" />
    </div>
  );
};

export default CardSkeleton;

