/**
 * ToastProvider - глобальный провайдер для Toast уведомлений
 * Должен быть размещен в корне приложения (App.tsx)
 */

import type { ReactNode } from 'react';
import { useContext } from 'react';
import { ToastContainer } from './ToastContainer';
import { ToastContextProvider, ToastContext } from '../../hooks/useToastContext';

/**
 * Внутренний компонент для отображения Toast
 */
const ToastDisplay = () => {
  const context = useContext(ToastContext);
  
  if (!context) return null;

  const { toasts, removeToast } = context;

  return (
    <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
  );
};

/**
 * Компонент ToastProvider
 */
export const ToastProvider = ({ children }: { children: ReactNode }) => {
  return (
    <ToastContextProvider>
      {children}
      <ToastDisplay />
    </ToastContextProvider>
  );
};

export default ToastProvider;

