/**
 * Компонент Input - поле ввода для приложения ARC
 * Поддерживает различные типы, размеры и состояния
 */

import { forwardRef, useEffect, useRef } from 'react';
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
  const internalRef = useRef<HTMLInputElement>(null);
  
  // Объединяем внешний ref и внутренний ref
  const getInputRef = () => {
    if (typeof ref === 'function') {
      return internalRef.current;
    } else if (ref && 'current' in ref) {
      return ref.current;
    }
    return internalRef.current;
  };
  
  // Принудительно разрешаем все события на инпуте
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    
    // Небольшая задержка чтобы инпут успел отрендериться
    const timeoutId = setTimeout(() => {
      const input = getInputRef();
      if (!input) return;
    
      // Устанавливаем стили
      input.style.userSelect = 'text';
      input.style.webkitUserSelect = 'text';
      (input.style as any).MozUserSelect = 'text';
      (input.style as any).msUserSelect = 'text';
      input.style.cursor = 'text';
      input.style.pointerEvents = 'auto';
      
      // Принудительно разрешаем все события мыши
      const allowMouseEvents = (e: MouseEvent | PointerEvent) => {
        // НЕ блокируем события - просто убеждаемся что они проходят
        if (e.target === input || input.contains(e.target as Node)) {
          // Событие на инпуте - разрешаем
          return;
        }
      };
      
      // Перехватываем события в фазе capture ДО того, как они дойдут до родителя
      input.addEventListener('mousedown', allowMouseEvents, { capture: true });
      input.addEventListener('mouseup', allowMouseEvents, { capture: true });
      input.addEventListener('click', allowMouseEvents, { capture: true });
      input.addEventListener('pointerdown', allowMouseEvents, { capture: true });
      input.addEventListener('pointerup', allowMouseEvents, { capture: true });
      input.addEventListener('selectstart', (e) => {
        // Разрешаем выделение
        if (e.target === input || input.contains(e.target as Node)) {
          return;
        }
      }, { capture: true });
      
      cleanup = () => {
        input.removeEventListener('mousedown', allowMouseEvents, { capture: true });
        input.removeEventListener('mouseup', allowMouseEvents, { capture: true });
        input.removeEventListener('click', allowMouseEvents, { capture: true });
        input.removeEventListener('pointerdown', allowMouseEvents, { capture: true });
        input.removeEventListener('pointerup', allowMouseEvents, { capture: true });
      };
    }, 10);
    
    return () => {
      clearTimeout(timeoutId);
      if (cleanup) cleanup();
    };
  }, [value]); // Перезапускаем при изменении value, чтобы обработать новые инпуты

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
          ref={(node) => {
            // Сохраняем в внутренний ref
            internalRef.current = node;
            
            // Также вызываем внешний ref если он есть
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
            }
          }}
          className={inputClassNames}
          disabled={disabled}
          value={value}
          style={{
            userSelect: 'text',
            WebkitUserSelect: 'text',
            MozUserSelect: 'text',
            msUserSelect: 'text',
            cursor: 'text',
            ...props.style
          }}
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

