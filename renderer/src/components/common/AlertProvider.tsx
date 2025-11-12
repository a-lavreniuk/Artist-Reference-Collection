/**
 * AlertProvider - глобальный провайдер для Alert диалогов
 * Должен быть размещен в корне приложения (App.tsx)
 */

import type { ReactNode } from 'react';
import { useContext } from 'react';
import { Alert } from './Alert';
import { AlertContextProvider, AlertContext } from '../../hooks/useAlert';

/**
 * Внутренний компонент для отображения Alert
 */
const AlertDisplay = () => {
  const context = useContext(AlertContext);
  
  if (!context) return null;

  const { state, confirm, cancel } = context;

  return (
    <Alert
      isOpen={state.isOpen}
      type={state.type}
      variant={state.variant}
      title={state.title}
      description={state.description}
      icon={state.icon}
      confirmText={state.confirmText}
      cancelText={state.cancelText}
      defaultValue={state.defaultValue}
      placeholder={state.placeholder}
      onConfirm={confirm}
      onCancel={cancel}
      closeOnOverlayClick={state.closeOnOverlayClick}
    />
  );
};

/**
 * Компонент AlertProvider
 */
export const AlertProvider = ({ children }: { children: ReactNode }) => {
  return (
    <AlertContextProvider>
      {children}
      <AlertDisplay />
    </AlertContextProvider>
  );
};

export default AlertProvider;

