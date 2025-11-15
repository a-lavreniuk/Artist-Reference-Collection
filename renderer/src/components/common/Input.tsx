/**
 * Компонент Input - поле ввода для приложения ARC
 * ПОЛНОСТЬЮ ПЕРЕПИСАН для исправления проблемы с выделением текста
 */

import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';
import './Input.css';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Метка поля */
  label?: string;
  
  /** Текст ошибки */
  error?: string;
  
  /** Текст подсказки */
  hint?: string;
  
  /** Размер поля */
  size?: 'medium' | 'large';
  
  /** Полная ширина */
  fullWidth?: boolean;
  
  /** Иконка слева */
  iconLeft?: ReactNode;
  
  /** Иконка справа */
  iconRight?: ReactNode;
  
  /** Кнопка очистки */
  clearable?: boolean;
  
  /** Обработчик очистки */
  onClear?: () => void;
}

/**
 * Компонент Input - НОВАЯ УПРОЩЁННАЯ ВЕРСИЯ
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  hint,
  size = 'medium',
  fullWidth = false,
  iconLeft,
  iconRight,
  clearable = false,
  onClear,
  disabled,
  className = '',
  value,
  style,
  ...props
}, ref) => {
  const hasError = Boolean(error);
  const showClearButton = clearable && value && !disabled;

  // Базовые стили инпута
  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: size === 'large' ? '48px' : '44px',
    padding: iconLeft ? '0 16px 0 56px' : (showClearButton || iconRight) ? '0 56px 0 16px' : '0 16px',
    fontSize: size === 'large' ? '18px' : '16px',
    fontFamily: 'var(--font-family-body)',
    fontWeight: 'var(--font-weight-regular)',
    lineHeight: 'var(--line-height-input)',
    color: 'var(--text-primary)',
    background: hasError ? 'var(--color-red-100)' : 'var(--color-grayscale-100)',
    border: 'none',
    borderRadius: '12px',
    outline: 'none',
    transition: 'all var(--transition-fast)',
    // КРИТИЧЕСКИ ВАЖНО: разрешаем выделение текста
    userSelect: 'text',
    WebkitUserSelect: 'text',
    cursor: 'text',
    ...style
  };

  // Стили контейнера
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
    width: fullWidth ? '100%' : 'auto'
  };

  // Стили иконки
  const iconStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    color: 'var(--icon-default)',
    pointerEvents: 'none'
  };

  // Стили кнопки очистки
  const clearButtonStyle: React.CSSProperties = {
    position: 'absolute',
    right: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    padding: '0',
    background: 'none',
    border: 'none',
    borderRadius: 'var(--radius-xs)',
    color: 'var(--icon-default)',
    cursor: 'pointer',
    opacity: 0.6,
    transition: 'all var(--transition-fast)'
  };

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', width: fullWidth ? '100%' : 'auto' }}>
      {label && (
        <label style={{ 
          fontSize: 'var(--font-size-s)', 
          color: 'var(--text-secondary)',
          cursor: 'pointer'
        }}>
          {label}
        </label>
      )}
      
      <div style={containerStyle}>
        {iconLeft && (
          <span style={{ ...iconStyle, left: '16px' }}>
            {iconLeft}
          </span>
        )}
        
        <input
          ref={ref}
          disabled={disabled}
          value={value}
          style={inputStyle}
          onMouseEnter={(e) => {
            if (!disabled && !hasError) {
              (e.target as HTMLInputElement).style.background = 'var(--color-grayscale-200)';
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled && !(e.target as HTMLInputElement).matches(':focus')) {
              (e.target as HTMLInputElement).style.background = hasError ? 'var(--color-red-100)' : 'var(--color-grayscale-100)';
            }
          }}
          onFocus={(e) => {
            (e.target as HTMLInputElement).style.background = hasError ? 'var(--color-red-100)' : 'var(--color-grayscale-200)';
          }}
          onBlur={(e) => {
            (e.target as HTMLInputElement).style.background = hasError ? 'var(--color-red-100)' : 'var(--color-grayscale-100)';
          }}
          {...props}
        />
        
        {showClearButton && (
          <button
            type="button"
            style={clearButtonStyle}
            onClick={onClear}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.opacity = '0.6';
            }}
            aria-label="Очистить"
            tabIndex={-1}
          >
            <Icon name="x" size={16} variant="border" />
          </button>
        )}
        
        {!showClearButton && iconRight && (
          <span style={{ ...iconStyle, right: '16px' }}>
            {iconRight}
          </span>
        )}
      </div>
      
      {(error || hint) && (
        <div style={{ fontSize: 'var(--font-size-s)', lineHeight: 'var(--line-height-s)', minHeight: '16px' }}>
          {error ? (
            <span style={{ color: 'var(--text-error)' }}>
              {error}
            </span>
          ) : (
            <span style={{ color: 'var(--text-secondary)' }}>
              {hint}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;

