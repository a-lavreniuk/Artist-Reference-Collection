/**
 * Компонент ToastContainer - контейнер для toast уведомлений
 */

import { createPortal } from 'react-dom';
import { Toast } from './Toast';

export interface ToastMessage {
  id: string;
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
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
          title={toast.title}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => onRemoveToast(toast.id)}
          onConfirm={toast.onConfirm}
          confirmText={toast.confirmText}
          cancelText={toast.cancelText}
        />
      ))}
    </div>,
    document.body
  );
};

export default ToastContainer;

