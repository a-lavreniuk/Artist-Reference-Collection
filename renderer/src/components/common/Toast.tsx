/**
 * Компонент Toast - всплывающее уведомление
 */

import { useEffect } from 'react';
import './Toast.css';

export interface ToastProps {
  /** Сообщение */
  message: string;
  
  /** Тип уведомления */
  type?: 'success' | 'error' | 'info';
  
  /** Длительность показа в мс */
  duration?: number;
  
  /** Callback при закрытии */
  onClose: () => void;
}

/**
 * Компонент Toast
 */
export const Toast = ({
  message,
  type = 'info',
  duration = 3000,
  onClose
}: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`toast toast--${type}`}>
      <div className="toast__content">
        {message}
      </div>
    </div>
  );
};

export default Toast;

