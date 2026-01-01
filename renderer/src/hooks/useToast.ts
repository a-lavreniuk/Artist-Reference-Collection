/**
 * Хук useToast - управление toast уведомлениями
 * Использует глобальный контекст ToastProvider
 */

import { useToastContext } from './useToastContext';

interface ToastOptions {
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export const useToast = () => {
  const { showToast } = useToastContext();

  return {
    showToast,
    success: (message: string, duration?: number) => showToast({ message, type: 'success', duration }),
    error: (message: string, duration?: number) => showToast({ message, type: 'error', duration }),
    info: (message: string, duration?: number) => showToast({ message, type: 'info', duration }),
    confirm: (options: Omit<ToastOptions, 'type'>) => showToast({ ...options, type: 'error' })
  };
};

