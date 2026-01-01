/**
 * Компонент Toast - уведомление с действиями
 * Используется для подтверждения важных действий (удаление, и т.д.)
 */

import { useEffect } from 'react';
import { Button } from './Button';
import './Toast.css';

export interface ToastProps {
  /** Заголовок */
  title?: string;
  
  /** Описание/сообщение */
  message: string;
  
  /** Тип уведомления */
  type?: 'success' | 'error' | 'info';
  
  /** Длительность показа в мс */
  duration?: number;
  
  /** Callback при закрытии */
  onClose: () => void;
  
  /** Callback при подтверждении */
  onConfirm?: () => void;
  
  /** Текст кнопки подтверждения */
  confirmText?: string;
  
  /** Текст кнопки отмены */
  cancelText?: string;
}

/**
 * Компонент Toast
 */
export const Toast = ({
  title,
  message,
  type = 'info',
  duration = 5000,
  onClose,
  onConfirm,
  confirmText = 'OK',
  cancelText = 'Отмена'
}: ToastProps) => {
  useEffect(() => {
    if (duration && !onConfirm) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose, onConfirm]);

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  return (
    <div 
      className={`toast toast--${type}`}
      style={{
        width: '480px',
        padding: '24px',
        backgroundColor: 'var(--color-grayscale-50)',
        border: '2px solid var(--border-default)',
        borderRadius: '24px',
        boxShadow: 'var(--shadow-xl)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        textAlign: 'left'
      }}
    >
      {/* Заголовок */}
      {title && (
        <h3 
          className="toast__title"
          style={{
            margin: 0,
            fontFamily: 'YS Music, sans-serif',
            fontSize: '22px',
            fontWeight: 700,
            lineHeight: '22px',
            letterSpacing: 0,
            color: 'var(--text-primary)'
          }}
        >
          {title}
        </h3>
      )}
      
      {/* Описание/сообщение */}
      <div 
        className="toast__content"
        style={{
          fontFamily: 'Geologica, sans-serif',
          fontSize: '16px',
          fontWeight: 300,
          lineHeight: '22px',
          letterSpacing: 0,
          color: 'var(--text-secondary)'
        }}
      >
        {message}
      </div>

      {/* Кнопки действий (если есть onConfirm) */}
      {onConfirm && (
        <div 
          className="toast__actions"
          style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
            marginTop: '8px'
          }}
        >
          <Button variant="border" size="S" onClick={onClose}>
            {cancelText}
          </Button>
          <Button 
            variant={type === 'error' ? 'error' : 'success'} 
            size="S" 
            onClick={handleConfirm}
          >
            {confirmText}
          </Button>
        </div>
      )}
    </div>
  );
};

export default Toast;

