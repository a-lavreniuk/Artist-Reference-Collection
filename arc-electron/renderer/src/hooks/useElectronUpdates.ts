/**
 * React hook для работы с обновлениями приложения в Electron
 * Управление автообновлениями через electron-updater
 */

import { useState, useEffect } from 'react';

interface UseElectronUpdatesReturn {
  /** Доступно обновление */
  needRefresh: boolean;
  
  /** Применить обновление и перезапустить */
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
}

/**
 * Hook для работы с автообновлениями Electron
 */
export function useElectronUpdates(): UseElectronUpdatesReturn {
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

  return {
    needRefresh,
    updateServiceWorker
  };
}

export default useElectronUpdates;



