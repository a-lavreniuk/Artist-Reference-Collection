/**
 * React hook для работы с PWA функционалом
 * Установка приложения, обновления, офлайн режим
 */

import { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface UsePWAReturn {
  /** Можно ли установить PWA */
  canInstall: boolean;
  
  /** Процесс установки */
  isInstalling: boolean;
  
  /** Приложение установлено */
  isInstalled: boolean;
  
  /** Доступно обновление */
  needRefresh: boolean;
  
  /** Офлайн режим */
  isOffline: boolean;
  
  /** Установить PWA */
  install: () => Promise<boolean>;
  
  /** Применить обновление */
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
}

/**
 * Hook для работы с PWA
 */
export function usePWA(): UsePWAReturn {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // PWA регистрация через vite-plugin-pwa
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegistered(registration) {
      console.log('[PWA] Service Worker зарегистрирован:', registration);
    },
    onRegisterError(error) {
      console.error('[PWA] Ошибка регистрации Service Worker:', error);
    },
    onNeedRefresh() {
      console.log('[PWA] Доступно обновление');
    }
  });

  // Слушаем событие beforeinstallprompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      console.log('[PWA] Приложение можно установить');
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  // Проверяем установлено ли приложение
  useEffect(() => {
    const checkInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        setCanInstall(false);
      }
    };

    checkInstalled();
  }, []);

  // Слушаем изменения онлайн/офлайн статуса
  useEffect(() => {
    const handleOnline = () => {
      console.log('[PWA] Соединение восстановлено');
      setIsOffline(false);
    };

    const handleOffline = () => {
      console.log('[PWA] Соединение потеряно — работаем офлайн');
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offine', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Установка PWA
  const install = async (): Promise<boolean> => {
    if (!deferredPrompt) {
      console.warn('[PWA] Нет отложенного prompt для установки');
      return false;
    }

    try {
      setIsInstalling(true);
      
      // Показываем prompt установки
      deferredPrompt.prompt();
      
      // Ждём выбора пользователя
      const { outcome } = await deferredPrompt.userChoice;
      
      console.log('[PWA] Результат установки:', outcome);
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setCanInstall(false);
        setDeferredPrompt(null);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[PWA] Ошибка установки:', error);
      return false;
    } finally {
      setIsInstalling(false);
    }
  };

  return {
    canInstall,
    isInstalling,
    isInstalled,
    needRefresh,
    isOffline,
    install,
    updateServiceWorker
  };
}

export default usePWA;

