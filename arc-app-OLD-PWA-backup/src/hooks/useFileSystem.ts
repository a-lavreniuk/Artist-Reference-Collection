/**
 * React hook для работы с File System Access API
 */

import { useState, useEffect, useCallback } from 'react';
import {
  isFileSystemSupported,
  requestWorkingDirectory,
  getSavedDirectoryHandle,
  verifyDirectoryPermission,
  type DirectoryHandle
} from '../services/fileSystem';

interface UseFileSystemReturn {
  /** Handle рабочей директории */
  directoryHandle: DirectoryHandle | null;
  
  /** Загружается ли handle */
  isLoading: boolean;
  
  /** Есть ли ошибка */
  error: Error | null;
  
  /** Поддерживается ли File System API */
  isSupported: boolean;
  
  /** Есть ли разрешения */
  hasPermission: boolean;
  
  /** Запросить выбор директории */
  requestDirectory: () => Promise<DirectoryHandle | null>;
  
  /** Проверить разрешения */
  checkPermission: () => Promise<boolean>;
  
  /** Очистить handle */
  clearDirectory: () => void;
}

/**
 * Hook для работы с файловой системой
 */
export function useFileSystem(): UseFileSystemReturn {
  const [directoryHandle, setDirectoryHandle] = useState<DirectoryHandle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [isSupported] = useState(isFileSystemSupported());

  /**
   * Загрузка сохранённого handle при монтировании
   */
  useEffect(() => {
    const loadSavedHandle = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (!isSupported) {
          throw new Error('File System Access API не поддерживается в этом браузере');
        }

        const savedHandle = await getSavedDirectoryHandle();
        
        if (savedHandle) {
          // Проверяем разрешения
          const permission = await verifyDirectoryPermission(savedHandle);
          
          if (permission) {
            setDirectoryHandle(savedHandle);
            setHasPermission(true);
          } else {
            // Разрешения потеряны, нужно запросить заново
            setHasPermission(false);
          }
        }
      } catch (err) {
        console.error('Ошибка загрузки handle:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSavedHandle();
  }, [isSupported]);

  /**
   * Запросить выбор директории
   */
  const requestDirectory = useCallback(async (): Promise<DirectoryHandle | null> => {
    try {
      setError(null);
      const handle = await requestWorkingDirectory();
      
      if (handle) {
        setDirectoryHandle(handle);
        setHasPermission(true);
      }
      
      return handle;
    } catch (err) {
      console.error('Ошибка запроса директории:', err);
      setError(err as Error);
      return null;
    }
  }, []);

  /**
   * Проверить разрешения
   */
  const checkPermission = useCallback(async (): Promise<boolean> => {
    if (!directoryHandle) {
      return false;
    }

    try {
      const permission = await verifyDirectoryPermission(directoryHandle);
      setHasPermission(permission);
      return permission;
    } catch (err) {
      console.error('Ошибка проверки разрешений:', err);
      setError(err as Error);
      return false;
    }
  }, [directoryHandle]);

  /**
   * Очистить handle
   */
  const clearDirectory = useCallback(() => {
    setDirectoryHandle(null);
    setHasPermission(false);
  }, []);

  return {
    directoryHandle,
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

