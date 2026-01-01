/**
 * DialogProvider - глобальный провайдер для Dialog окон
 * Должен быть размещен в корне приложения (App.tsx)
 */

import type { ReactNode } from 'react';
import { useContext } from 'react';
import { Dialog } from './Dialog';
import { DialogContextProvider, DialogContext } from '../../hooks/useDialog';

/**
 * Внутренний компонент для отображения Dialog
 */
const DialogDisplay = () => {
  const context = useContext(DialogContext);
  
  if (!context) return null;

  const { state, confirm, cancel } = context;

  return (
    <Dialog
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
 * Компонент DialogProvider
 */
export const DialogProvider = ({ children }: { children: ReactNode }) => {
  return (
    <DialogContextProvider>
      {children}
      <DialogDisplay />
    </DialogContextProvider>
  );
};

export default DialogProvider;

