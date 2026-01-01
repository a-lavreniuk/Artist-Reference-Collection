/**
 * Hook для работы с Alert уведомлениями
 * Alert = горизонтальный баннер внизу экрана по центру
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { AlertType } from '../components/common/Alert';

interface AlertState {
  show: boolean;
  type: AlertType;
  message: string;
  duration: number | null;
}

interface AlertContextType {
  state: AlertState;
  showAlert: (type: AlertType, message: string, duration?: number | null) => void;
  hideAlert: () => void;
}

export const AlertContext = createContext<AlertContextType | null>(null);

/**
 * Provider для Alert контекста
 */
export const AlertContextProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AlertState>({
    show: false,
    type: 'info',
    message: '',
    duration: 5000
  });

  const showAlert = useCallback((type: AlertType, message: string, duration: number | null = 5000) => {
    setState({
      show: true,
      type,
      message,
      duration
    });
  }, []);

  const hideAlert = useCallback(() => {
    setState(prev => ({ ...prev, show: false }));
  }, []);

  return (
    <AlertContext.Provider value={{ state, showAlert, hideAlert }}>
      {children}
    </AlertContext.Provider>
  );
};

/**
 * Hook для работы с Alert
 */
export function useAlert() {
  const context = useContext(AlertContext);
  
  if (!context) {
    throw new Error('useAlert должен использоваться внутри AlertContextProvider');
  }

  const { showAlert } = context;

  return {
    success: (message: string, duration?: number | null) => showAlert('success', message, duration),
    error: (message: string, duration?: number | null) => showAlert('error', message, duration),
    warning: (message: string, duration?: number | null) => showAlert('warning', message, duration),
    info: (message: string, duration?: number | null) => showAlert('info', message, duration)
  };
}

export default useAlert;

