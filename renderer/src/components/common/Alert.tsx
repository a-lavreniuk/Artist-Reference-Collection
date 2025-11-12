/**
 * Компонент Alert - модальные диалоги для подтверждения действий
 * Типы: confirm (подтверждение), info (информация), prompt (ввод)
 */

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { Icon } from './Icon';
import { Input } from './Input';
import './Alert.css';

export type AlertType = 'confirm' | 'info' | 'prompt';
export type AlertVariant = 'default' | 'destructive';

export interface AlertProps {
  /** Открыт ли диалог */
  isOpen: boolean;
  
  /** Тип диалога */
  type: AlertType;
  
  /** Вариант стиля (для деструктивных действий) */
  variant?: AlertVariant;
  
  /** Заголовок */
  title: string;
  
  /** Описание/текст */
  description: string;
  
  /** Иконка (ReactNode или название из Icon) */
  icon?: ReactNode | string;
  
  /** Текст кнопки подтверждения */
  confirmText?: string;
  
  /** Текст кнопки отмены */
  cancelText?: string;
  
  /** Значение по умолчанию для prompt */
  defaultValue?: string;
  
  /** Placeholder для prompt */
  placeholder?: string;
  
  /** Callback при подтверждении */
  onConfirm: (value?: string) => void;
  
  /** Callback при отмене */
  onCancel: () => void;
  
  /** Закрывать при клике на overlay */
  closeOnOverlayClick?: boolean;
}

/**
 * Компонент Alert
 */
export const Alert = ({
  isOpen,
  type,
  variant = 'default',
  title,
  description,
  icon,
  confirmText = 'OK',
  cancelText = 'Отмена',
  defaultValue = '',
  placeholder,
  onConfirm,
  onCancel,
  closeOnOverlayClick = false
}: AlertProps) => {
  const [inputValue, setInputValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Сброс значения при открытии
  useEffect(() => {
    if (isOpen && type === 'prompt') {
      setInputValue(defaultValue);
      // Фокус на input при открытии prompt
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, type, defaultValue]);

  // Блокируем скролл body
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Закрытие по Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onCancel]);

  // Подтверждение по Enter (только для info и confirm)
  useEffect(() => {
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && isOpen && type !== 'prompt') {
        onConfirm();
      }
    };
    document.addEventListener('keydown', handleEnter);
    return () => document.removeEventListener('keydown', handleEnter);
  }, [isOpen, type, onConfirm]);

  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onCancel();
    }
  };

  const handleConfirm = () => {
    if (type === 'prompt') {
      onConfirm(inputValue);
    } else {
      onConfirm();
    }
  };

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleConfirm();
  };

  // Определяем иконку
  const renderIcon = () => {
    if (!icon) return null;

    // Если icon - это string, используем компонент Icon
    if (typeof icon === 'string') {
      return (
        <div className={`alert__icon alert__icon--${variant}`}>
          <Icon name={icon as any} size={32} variant="fill" />
        </div>
      );
    }

    // Иначе рендерим как ReactNode
    return <div className={`alert__icon alert__icon--${variant}`}>{icon}</div>;
  };

  const alertClassName = `alert alert--${type} alert--${variant}`;

  return createPortal(
    <div className="alert-overlay" onClick={handleOverlayClick}>
      <div className={alertClassName} role="alertdialog" aria-modal="true">
        {/* Кнопка закрытия */}
        <button
          type="button"
          className="alert__close"
          onClick={onCancel}
          aria-label="Закрыть"
        >
          <Icon name="x" size={24} variant="border" />
        </button>

        {/* Иконка (если есть) */}
        {renderIcon()}

        {/* Заголовок */}
        <h3 className="alert__title">{title}</h3>

        {/* Описание */}
        <p className="alert__description">{description}</p>

        {/* Input для prompt */}
        {type === 'prompt' && (
          <form onSubmit={handlePromptSubmit}>
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholder}
              autoFocus
            />
          </form>
        )}

        {/* Кнопки действий */}
        <div className="alert__actions">
          {type !== 'info' && (
            <Button variant="border" size="L" onClick={onCancel}>
              {cancelText}
            </Button>
          )}
          
          <Button
            variant={variant === 'destructive' ? 'error' : 'primary'}
            size="L"
            onClick={handleConfirm}
            iconRight={
              variant === 'destructive' && type === 'confirm' ? (
                <Icon name="trash-3" size={24} variant="fill" />
              ) : type === 'info' ? (
                <Icon name="check" size={24} variant="border" />
              ) : undefined
            }
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Alert;

