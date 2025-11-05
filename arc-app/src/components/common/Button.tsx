/**
 * Компонент Button - универсальная кнопка для приложения ARC
 * Поддерживает различные варианты, размеры и состояния
 */

import { ButtonHTMLAttributes, ReactNode } from 'react';
import './Button.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Вариант отображения кнопки */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  
  /** Размер кнопки */
  size?: 'small' | 'medium' | 'large';
  
  /** Полная ширина */
  fullWidth?: boolean;
  
  /** Состояние загрузки */
  loading?: boolean;
  
  /** Иконка слева */
  iconLeft?: ReactNode;
  
  /** Иконка справа */
  iconRight?: ReactNode;
  
  /** Только иконка (без текста) */
  iconOnly?: boolean;
  
  /** Дочерние элементы */
  children?: ReactNode;
}

/**
 * Компонент Button
 */
export const Button = ({
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  loading = false,
  iconLeft,
  iconRight,
  iconOnly = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) => {
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
      
      {!loading && iconLeft && (
        <span className="button__icon button__icon--left">
          {iconLeft}
        </span>
      )}
      
      {!iconOnly && children && (
        <span className="button__text">
          {children}
        </span>
      )}
      
      {!loading && iconRight && (
        <span className="button__icon button__icon--right">
          {iconRight}
        </span>
      )}
    </button>
  );
};

export default Button;

