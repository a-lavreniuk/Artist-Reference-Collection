/**
 * AlertProvider - глобальный провайдер для Alert баннеров
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

  const { state, hideAlert } = context;

  return (
    <Alert
      show={state.show}
      type={state.type}
      message={state.message}
      duration={state.duration}
      onClose={hideAlert}
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

