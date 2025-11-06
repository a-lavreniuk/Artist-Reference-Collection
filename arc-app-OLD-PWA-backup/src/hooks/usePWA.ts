/**
 * React hook для работы с PWA функционалом
 * Установка приложения, обновления, офлайн режим
 */

import { useState, useEffect } from 'react';

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
  const [needRefresh, setNeedRefresh] = useState(false);

  // Функция обновления Service Worker
  const updateServiceWorker = async (reloadPage?: boolean) => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        if (reloadPage) {
          window.location.reload();
        }
      }
    }
  };

  // Проверка обновлений Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(
        (registration: any) => {
          console.log('[PWA] Service Worker зарегистрирован:', registration);
          
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker?.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setNeedRefresh(true);
                console.log('[PWA] Доступно обновление');
              }
            });
          });
        },
        (error: any) => {
          console.error('[PWA] Ошибка регистрации Service Worker:', error);
        }
      );
    }
  }, []);

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

