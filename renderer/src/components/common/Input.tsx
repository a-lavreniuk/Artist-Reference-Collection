/**
 * Компонент Input - поле ввода для приложения ARC
 * Поддерживает различные типы, размеры и состояния
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
 * Компонент Input
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
  ...props
}, ref) => {
  const hasError = Boolean(error);
  const showClearButton = clearable && value && !disabled;

  const wrapperClassNames = [
    'input-wrapper',
    fullWidth && 'input-wrapper--full-width',
    className
  ].filter(Boolean).join(' ');

  const inputClassNames = [
    'input',
    `input--${size}`,
    hasError && 'input--error',
    iconLeft && 'input--with-icon-left',
    (iconRight || showClearButton) && 'input--with-icon-right',
    disabled && 'input--disabled'
  ].filter(Boolean).join(' ');

  const handleClear = () => {
    onClear?.();
  };

  return (
    <div className={wrapperClassNames}>
      {label && (
        <label className="input-label">
          {label}
        </label>
      )}
      
      <div className="input-container">
        {iconLeft && (
          <span className="input__icon input__icon--left">
            {iconLeft}
          </span>
        )}
        
        <input
          ref={ref}
          className={inputClassNames}
          disabled={disabled}
          value={value}
          {...props}
        />
        
        {showClearButton && (
          <button
            type="button"
            className="input__clear"
            onClick={handleClear}
            aria-label="Очистить"
            tabIndex={-1}
          >
            <Icon name="x" size={16} variant="border" />
          </button>
        )}
        
        {!showClearButton && iconRight && (
          <span className="input__icon input__icon--right">
            {iconRight}
          </span>
        )}
      </div>
      
      {(error || hint) && (
        <div className="input-message">
          {error ? (
            <span className="input-message--error">
              {error}
            </span>
          ) : (
            <span className="input-message--hint">
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

