/**
 * React hook для работы с файловой системой через Electron API
 */

import { useState, useEffect, useCallback } from 'react';

interface UseFileSystemReturn {
  /** Путь к рабочей директории */
  directoryPath: string | null;
  
  /** Загружается ли путь */
  isLoading: boolean;
  
  /** Есть ли ошибка */
  error: Error | null;
  
  /** Поддерживается ли Electron API */
  isSupported: boolean;
  
  /** Есть ли путь к рабочей папке */
  hasPermission: boolean;
  
  /** Запросить выбор директории */
  requestDirectory: () => Promise<string | null>;
  
  /** Проверить наличие сохраненного пути */
  checkPermission: () => Promise<boolean>;
  
  /** Очистить путь */
  clearDirectory: () => void;
  
  /** Устаревшее свойство для совместимости */
  directoryHandle: string | null;
}

/**
 * Hook для работы с файловой системой через Electron
 */
export function useFileSystem(): UseFileSystemReturn {
  const [directoryPath, setDirectoryPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  // В Electron всегда поддерживается работа с файловой системой
  const [isSupported] = useState(typeof window !== 'undefined' && 'electronAPI' in window);

  /**
   * Загрузка сохранённого пути при монтировании
   */
  useEffect(() => {
    const loadSavedPath = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (!isSupported) {
          console.warn('[Electron] API не доступен, возможно запущено в браузере');
          setIsLoading(false);
          return;
        }

        // Загружаем сохраненный путь из настроек приложения
        // Используем localStorage как временное хранилище
        const savedPath = localStorage.getItem('arc_working_directory');
        
        if (savedPath) {
          // Проверяем существование директории
          const exists = await window.electronAPI.fileExists(savedPath);
          
          if (exists) {
            setDirectoryPath(savedPath);
            setHasPermission(true);
            console.log('[FileSystem] Загружен сохраненный путь:', savedPath);
          } else {
            // Директория больше не существует
            console.warn('[FileSystem] Сохраненная директория не найдена');
            localStorage.removeItem('arc_working_directory');
            setHasPermission(false);
          }
        }
      } catch (err) {
        console.error('[FileSystem] Ошибка загрузки пути:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSavedPath();
  }, [isSupported]);

  /**
   * Запросить выбор директории через Electron диалог
   */
  const requestDirectory = useCallback(async (): Promise<string | null> => {
    try {
      setError(null);
      
      if (!isSupported) {
        throw new Error('Electron API недоступен');
      }
      
      const path = await window.electronAPI.selectWorkingDirectory();
      
      if (path) {
        setDirectoryPath(path);
        setHasPermission(true);
        // Сохраняем путь для следующего запуска
        localStorage.setItem('arc_working_directory', path);
        console.log('[FileSystem] Выбрана рабочая директория:', path);
      }
      
      return path || null;
    } catch (err) {
      console.error('[FileSystem] Ошибка запроса директории:', err);
      setError(err as Error);
      return null;
    }
  }, [isSupported]);

  /**
   * Проверить наличие сохраненного пути
   */
  const checkPermission = useCallback(async (): Promise<boolean> => {
    if (!directoryPath) {
      return false;
    }

    try {
      const exists = await window.electronAPI.fileExists(directoryPath);
      setHasPermission(exists);
      return exists;
    } catch (err) {
      console.error('[FileSystem] Ошибка проверки директории:', err);
      setError(err as Error);
      return false;
    }
  }, [directoryPath]);

  /**
   * Очистить путь
   */
  const clearDirectory = useCallback(() => {
    setDirectoryPath(null);
    setHasPermission(false);
    localStorage.removeItem('arc_working_directory');
    console.log('[FileSystem] Рабочая директория очищена');
  }, []);

  return {
    directoryPath,
    directoryHandle: directoryPath, // Для обратной совместимости
    isLoading,
    error,
    isSupported,
    hasPermission,
    requestDirectory,
    checkPermission,
    clearDirectory
  };
}

export default useFileSystem;

