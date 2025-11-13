/**
 * Hook для работы с Toast уведомлениями
 * Toast = всплывающие уведомления в правом нижнем углу
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { ToastMessage } from '../components/common/ToastContainer';

interface ToastOptions {
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

interface ToastContextType {
  toasts: ToastMessage[];
  showToast: (options: ToastOptions) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextType | null>(null);

/**
 * Provider для Toast контекста
 */
export const ToastContextProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((options: ToastOptions) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: ToastMessage = {
      id,
      title: options.title,
      message: options.message,
      type: options.type || 'info',
      duration: options.duration || (options.onConfirm ? undefined : 3000),
      onConfirm: options.onConfirm,
      confirmText: options.confirmText,
      cancelText: options.cancelText
    };

    // Заменяем предыдущий Toast, а не добавляем к массиву
    // Toast всегда отображается в одном экземпляре
    setToasts([newToast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};

/**
 * Hook для работы с Toast
 */
export function useToastContext() {
  const context = useContext(ToastContext);
  
  if (!context) {
    throw new Error('useToastContext должен использоваться внутри ToastContextProvider');
  }

  return context;
}

export default useToastContext;

