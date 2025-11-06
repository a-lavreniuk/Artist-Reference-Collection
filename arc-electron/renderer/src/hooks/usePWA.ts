/**
 * React hook для работы с обновлениями приложения в Electron
 * Управление автообновлениями через electron-updater
 */

import { useState, useEffect } from 'react';

interface UseElectronUpdatesReturn {
  /** Можно ли установить приложение (не используется в Electron) */
  canInstall: boolean;
  
  /** Процесс установки (не используется) */
  isInstalling: boolean;
  
  /** Приложение установлено (всегда true в Electron) */
  isInstalled: boolean;
  
  /** Доступно обновление */
  needRefresh: boolean;
  
  /** Офлайн режим (не используется в Electron) */
  isOffline: boolean;
  
  /** Установить приложение (не используется в Electron) */
  install: () => Promise<boolean>;
  
  /** Применить обновление и перезапустить */
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
}

/**
 * Hook для работы с автообновлениями Electron
 * Сохранён старое имя usePWA для обратной совместимости
 */
export function usePWA(): UseElectronUpdatesReturn {
  // В Electron эти состояния упрощены
  const [needRefresh, setNeedRefresh] = useState(false);

  /**
   * Функция применения обновления через electron-updater
   */
  const updateServiceWorker = async (reloadPage?: boolean) => {
    try {
      if (window.electronAPI && window.electronAPI.installUpdate) {
        await window.electronAPI.installUpdate();
        console.log('[Updates] Обновление будет установлено при следующем запуске');
      } else if (reloadPage) {
        // Fallback - перезагрузка окна
        window.location.reload();
      }
    } catch (error) {
      console.error('[Updates] Ошибка при применении обновления:', error);
    }
  };

  /**
   * Слушаем события обновлений от Electron
   */
  useEffect(() => {
    if (window.electronAPI) {
      // Подписываемся на событие доступности обновления
      window.electronAPI.onUpdateAvailable(() => {
        console.log('[Electron] Доступно обновление');
        // Пока просто логируем, можно показать уведомление позже
      });

      // Подписываемся на событие готовности обновления
      window.electronAPI.onUpdateReady(() => {
        console.log('[Electron] Обновление готово к установке');
        setNeedRefresh(true);
      });

      console.log('[Electron] Подписка на события обновлений настроена');
    } else {
      console.warn('[Electron] API недоступен для обновлений');
    }
  }, []);

  /**
   * Заглушка для установки (не используется в десктопном приложении)
   */
  const install = async (): Promise<boolean> => {
    console.warn('[Install] Функция не применима для десктопного приложения');
    return false;
  };

  return {
    canInstall: false, // В Electron приложение уже "установлено"
    isInstalling: false,
    isInstalled: true, // Всегда true в Electron
    needRefresh,
    isOffline: false, // Electron приложение всегда "онлайн"
    install,
    updateServiceWorker
  };
}

export default usePWA;

