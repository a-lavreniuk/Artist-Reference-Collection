/**
 * Компонент Button - универсальная кнопка для приложения ARC
 * Поддерживает различные варианты, размеры и состояния согласно дизайн-системе
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './Button.css';

/**
 * Форматирует число для отображения в счетчике кнопки
 * - 0 → null (скрывается)
 * - 1–999 → как есть (7, 42, 999)
 * - ≥1000 → 1.2K (одна десятичная, до 4 символов)
 */
export function formatCounter(value: number | undefined | null): string | null {
  if (value == null || value === 0) return null;
  if (value < 1000) return String(value);
  
  // Для чисел >= 1000 форматируем как X.XK
  const thousands = value / 1000;
  if (thousands >= 100) {
    // Для чисел >= 100K показываем без десятичной (100K, 999K)
    return `${Math.floor(thousands)}K`;
  }
  // Для чисел < 100K показываем одну десятичную (1.2K, 99.9K)
  return `${thousands.toFixed(1)}K`;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Вариант отображения кнопки */
  variant?: 'primary' | 'secondary' | 'border' | 'ghost' | 'error' | 'warning' | 'success';
  
  /** Размер кнопки (L = большая 56px, S = малая 40px) */
  size?: 'L' | 'S';
  
  /** Полная ширина */
  fullWidth?: boolean;
  
  /** Состояние загрузки (показывает спиннер) */
  loading?: boolean;
  
  /** Иконка слева от текста */
  iconLeft?: ReactNode;
  
  /** Иконка справа от текста */
  iconRight?: ReactNode;
  
  /** Только иконка (без текста) */
  iconOnly?: boolean;
  
  /** Счетчик (badge) - отображается справа от текста */
  counter?: number;
  
  /** Дочерние элементы (текст кнопки) */
  children?: ReactNode;
}

/**
 * Компонент Button
 */
export const Button = ({
  variant = 'primary',
  size = 'L',
  fullWidth = false,
  loading = false,
  iconLeft,
  iconRight,
  iconOnly = false,
  counter,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) => {
  // Форматируем счетчик согласно требованиям
  const formattedCounter = formatCounter(counter);
  
  // Формируем классы
  const classNames = [
    'button',
    `button--${variant}`,
    `button--${size}`,
    fullWidth && 'button--full-width',
    iconOnly && 'button--icon-only',
    loading && 'button--loading',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      className={classNames}
      disabled={disabled || loading}
      {...props}
    >
      {/* Лоадер (спиннер) при загрузке */}
      {loading && (
        <span className="button__loader">
          <svg className="button__spinner" viewBox="0 0 24 24">
            <circle
              className="button__spinner-circle"
              cx="12"
              cy="12"
              r="10"
              fill="none"
              strokeWidth="3"
            />
          </svg>
        </span>
      )}
      
      {/* Иконка слева */}
      {!loading && iconLeft && (
        <span className="button__icon button__icon--left">
          {iconLeft}
        </span>
      )}
      
      {/* Текст кнопки */}
      {!iconOnly && children && (
        <span className="button__value">
          {children}
        </span>
      )}
      
      {/* Счетчик (badge) */}
      {!iconOnly && !loading && formattedCounter && (
        <span className="button__counter">
          {formattedCounter}
        </span>
      )}
      
      {/* Иконка справа */}
      {!loading && iconRight && (
        <span className="button__icon button__icon--right">
          {iconRight}
        </span>
      )}
    </button>
  );
};

export default Button;

