/**
 * Компонент ToastContainer - контейнер для toast уведомлений
 */

import { createPortal } from 'react-dom';
import { Toast } from './Toast';
import './Toast.css';

export interface ToastMessage {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
}

export interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemoveToast: (id: string) => void;
}

/**
 * Компонент ToastContainer
 */
export const ToastContainer = ({ toasts, onRemoveToast }: ToastContainerProps) => {
  return createPortal(
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => onRemoveToast(toast.id)}
        />
      ))}
    </div>,
    document.body
  );
};

export default ToastContainer;

