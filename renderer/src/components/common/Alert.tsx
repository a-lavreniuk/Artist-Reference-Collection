/**
 * Компонент Alert - горизонтальные уведомления внизу экрана
 * Типы: success, error, warning, info
 * Позиция: внизу экрана по центру
 */

import { useEffect } from 'react';
import { Icon, type IconName } from './Icon';
import './Alert.css';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface AlertProps {
  /** Тип уведомления */
  type: AlertType;
  
  /** Сообщение */
  message: string;
  
  /** Показывать ли уведомление */
  show: boolean;
  
  /** Callback при закрытии */
  onClose: () => void;
  
  /** Длительность показа в мс (null = не закрывать автоматически) */
  duration?: number | null;
}

// Иконки для каждого типа
const alertIcons: Record<AlertType, IconName> = {
  success: 'check',
  error: 'x',
  warning: 'x', // Используем x, т.к. нет треугольника с восклицательным знаком
  info: 'check' // Используем check, т.к. нет question mark
};

/**
 * Компонент Alert
 */
export const Alert = ({
  type,
  message,
  show,
  onClose,
  duration = 5000
}: AlertProps) => {
  // Автозакрытие
  useEffect(() => {
    if (!show || duration === null) return;

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [show, duration, onClose]);

  if (!show) {
    return null;
  }

  return (
    <div className={`alert alert--${type}`}>
      <div className="alert__container">
        {/* Иконка */}
        <div className="alert__icon">
          <Icon name={alertIcons[type]} size={24} variant="fill" />
        </div>

        {/* Сообщение */}
        <p className="alert__message">{message}</p>

        {/* Кнопка закрытия */}
        <button
          type="button"
          className="alert__close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          <Icon name="x" size={24} variant="border" />
        </button>
      </div>
    </div>
  );
};

export default Alert;

