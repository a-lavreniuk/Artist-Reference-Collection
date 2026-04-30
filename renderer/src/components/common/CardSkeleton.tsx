/**
 * Компонент CardSkeleton - скелетон для карточки в процессе загрузки
 * Отображает placeholder точно такого же размера как карточка
 */

import './CardSkeleton.css';

export interface CardSkeletonProps {
  /** Компактный вид */
  compact?: boolean;

  /** Соотношение сторон карточки (width / height) */
  aspectRatio?: number;
}

/**
 * Компонент CardSkeleton
 */
export const CardSkeleton = ({ compact = false, aspectRatio = 1 }: CardSkeletonProps) => {
  const classNames = [
    'card-skeleton',
    compact && 'card-skeleton--compact'
  ].filter(Boolean).join(' ');

  const safeAspectRatio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;

  return (
    <div
      className={classNames}
      style={{ ['--card-skeleton-aspect-ratio' as string]: String(safeAspectRatio) }}
    >
      <div className="card-skeleton__image skeleton" />
    </div>
  );
};

export default CardSkeleton;

