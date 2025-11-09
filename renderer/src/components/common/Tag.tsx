/**
 * Компонент Tag - метка для категоризации карточек
 * Поддерживает различные варианты, размеры и состояния
 */

import type { HTMLAttributes, ReactNode } from 'react';
import './Tag.css';

export interface TagProps extends HTMLAttributes<HTMLDivElement> {
  /** Вариант отображения метки */
  variant?: 'default' | 'active' | 'overlay';
  
  /** Размер метки */
  size?: 'small' | 'medium';
  
  /** Можно ли удалить */
  removable?: boolean;
  
  /** Обработчик удаления */
  onRemove?: () => void;
  
  /** Цвет метки */
  color?: string;
  
  /** Счётчик (количество карточек) */
  count?: number;
  
  /** Иконка */
  icon?: ReactNode;
  
  /** Дочерние элементы */
  children: ReactNode;
}

/**
 * Компонент Tag
 */
export const Tag = ({
  variant = 'default',
  size = 'medium',
  removable = false,
  onRemove,
  color,
  count,
  icon,
  className = '',
  children,
  style,
  ...props
}: TagProps) => {
  const classNames = [
    'tag',
    `tag--${variant}`,
    `tag--${size}`,
    removable && 'tag--removable',
    className
  ].filter(Boolean).join(' ');

  const tagStyle = style;

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.();
  };

  return (
    <div
      className={classNames}
      style={tagStyle}
      {...props}
    >
      {icon && (
        <span className="tag__icon">
          {icon}
        </span>
      )}
      
      <span className="tag__text">
        {children}
      </span>
      
      {count !== undefined && count > 0 && (
        <span className="tag__count">
          {count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count}
        </span>
      )}
      
      {removable && (
        <button
          type="button"
          className="tag__remove"
          onClick={handleRemoveClick}
          aria-label="Удалить метку"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9 3L3 9M3 3L9 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
};

export default Tag;

