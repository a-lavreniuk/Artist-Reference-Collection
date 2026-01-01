/**
 * Hook для работы с Dialog окнами
 * Предоставляет Promise-based API для confirm, info и prompt
 * Dialog = модальное окно по центру экрана
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { DialogType, DialogVariant } from '../components/common/Dialog';

interface DialogState {
  isOpen: boolean;
  type: DialogType;
  variant: DialogVariant;
  title: string;
  description: string;
  icon?: ReactNode | string;
  confirmText: string;
  cancelText: string;
  defaultValue?: string;
  placeholder?: string;
  closeOnOverlayClick: boolean;
  resolve?: (value: boolean | string | null) => void;
}

interface DialogContextType {
  state: DialogState;
  show: (options: Partial<DialogState>) => void;
  confirm: (value?: string) => void;
  cancel: () => void;
}

export const DialogContext = createContext<DialogContextType | null>(null);

/**
 * Provider для Dialog контекста
 */
export const DialogContextProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<DialogState>({
    isOpen: false,
    type: 'confirm',
    variant: 'default',
    title: '',
    description: '',
    confirmText: 'OK',
    cancelText: 'Отмена',
    closeOnOverlayClick: false
  });

  const show = useCallback((options: Partial<DialogState>) => {
    setState(prev => ({
      ...prev,
      ...options,
      isOpen: true
    }));
  }, []);

  const hide = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
    setTimeout(() => {
      setState(prev => ({ ...prev, resolve: undefined }));
    }, 300);
  }, []);

  const confirm = useCallback((value?: string) => {
    if (state.resolve) {
      if (state.type === 'prompt') {
        state.resolve(value || '');
      } else {
        state.resolve(true);
      }
    }
    hide();
  }, [state.resolve, state.type, hide]);

  const cancel = useCallback(() => {
    if (state.resolve) {
      if (state.type === 'prompt') {
        state.resolve(null);
      } else {
        state.resolve(false);
      }
    }
    hide();
  }, [state.resolve, state.type, hide]);

  return (
    <DialogContext.Provider value={{ state, show, confirm, cancel }}>
      {children}
    </DialogContext.Provider>
  );
};

interface ConfirmOptions {
  title: string;
  description: string;
  icon?: ReactNode | string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
  closeOnOverlayClick?: boolean;
}

interface InfoOptions {
  title: string;
  description: string;
  icon?: ReactNode | string;
  confirmText?: string;
  closeOnOverlayClick?: boolean;
}

interface PromptOptions {
  title: string;
  description: string;
  icon?: ReactNode | string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  closeOnOverlayClick?: boolean;
}

/**
 * Hook для работы с Dialog окнами
 */
export function useDialog() {
  const context = useContext(DialogContext);
  
  if (!context) {
    throw new Error('useDialog должен использоваться внутри DialogContextProvider');
  }

  const { show } = context;

  /**
   * Показать confirm dialog
   * @returns Promise<boolean> - true если подтвердили, false если отменили
   */
  const confirmDialog = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      show({
        type: 'confirm',
        variant: options.variant || 'default',
        title: options.title,
        description: options.description,
        icon: options.icon,
        confirmText: options.confirmText || 'Подтвердить',
        cancelText: options.cancelText || 'Отмена',
        closeOnOverlayClick: options.closeOnOverlayClick || false,
        resolve: resolve as (value: boolean | string | null) => void
      });
    });
  };

  /**
   * Показать info dialog
   * @returns Promise<void>
   */
  const infoDialog = (options: InfoOptions): Promise<void> => {
    return new Promise((resolve) => {
      show({
        type: 'info',
        variant: 'default',
        title: options.title,
        description: options.description,
        icon: options.icon,
        confirmText: options.confirmText || 'OK',
        closeOnOverlayClick: options.closeOnOverlayClick || false,
        resolve: () => resolve()
      });
    });
  };

  /**
   * Показать prompt dialog
   * @returns Promise<string | null> - введенное значение или null если отменили
   */
  const promptDialog = (options: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      show({
        type: 'prompt',
        variant: 'default',
        title: options.title,
        description: options.description,
        icon: options.icon,
        defaultValue: options.defaultValue || '',
        placeholder: options.placeholder,
        confirmText: options.confirmText || 'Сохранить',
        cancelText: options.cancelText || 'Отмена',
        closeOnOverlayClick: options.closeOnOverlayClick || false,
        resolve: resolve as (value: boolean | string | null) => void
      });
    });
  };

  return {
    confirm: confirmDialog,
    info: infoDialog,
    prompt: promptDialog
  };
}

export default useDialog;

