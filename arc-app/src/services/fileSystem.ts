/**
 * Сервис для работы с файловой системой через File System Access API
 * Обеспечивает доступ к локальным медиафайлам пользователя
 */

/**
 * Тип handle директории
 */
export type DirectoryHandle = FileSystemDirectoryHandle;

/**
 * Тип handle файла
 */
export type FileHandle = FileSystemFileHandle;

/**
 * Проверка поддержки File System Access API
 */
export function isFileSystemSupported(): boolean {
  return 'showDirectoryPicker' in window;
}

/**
 * Запросить доступ к рабочей папке
 * Открывает системный диалог выбора папки
 */
export async function requestWorkingDirectory(): Promise<DirectoryHandle | null> {
  try {
    if (!isFileSystemSupported()) {
      throw new Error('File System Access API не поддерживается в этом браузере');
    }

    // Открываем диалог выбора папки
    const directoryHandle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents'
    });

    // Сохраняем handle в IndexedDB для последующего использования
    await saveDirectoryHandle(directoryHandle);

    return directoryHandle;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      // Пользователь отменил выбор
      console.log('Пользователь отменил выбор папки');
      return null;
    }
    console.error('Ошибка при выборе папки:', error);
    throw error;
  }
}

/**
 * Проверить разрешения для директории
 */
export async function verifyDirectoryPermission(
  directoryHandle: DirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<boolean> {
  try {
    const options = { mode };
    
    // Проверяем текущие разрешения
    if ((await directoryHandle.queryPermission(options)) === 'granted') {
      return true;
    }
    
    // Запрашиваем разрешения если их нет
    if ((await directoryHandle.requestPermission(options)) === 'granted') {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Ошибка проверки разрешений:', error);
    return false;
  }
}

/**
 * Получить сохранённый handle рабочей папки
 */
export async function getSavedDirectoryHandle(): Promise<DirectoryHandle | null> {
  try {
    // IndexedDB для хранения handles
    const db = await openHandleDB();
    const transaction = db.transaction(['handles'], 'readonly');
    const store = transaction.objectStore('handles');
    const request = store.get('workingDirectory');

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result?.handle || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Ошибка получения handle:', error);
    return null;
  }
}

/**
 * Сохранить handle рабочей папки
 */
async function saveDirectoryHandle(handle: DirectoryHandle): Promise<void> {
  try {
    const db = await openHandleDB();
    const transaction = db.transaction(['handles'], 'readwrite');
    const store = transaction.objectStore('handles');
    
    await store.put({
      id: 'workingDirectory',
      handle,
      savedAt: new Date()
    });
  } catch (error) {
    console.error('Ошибка сохранения handle:', error);
    throw error;
  }
}

/**
 * Открыть IndexedDB для хранения file handles
 */
function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ARC_FileHandles', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles', { keyPath: 'id' });
      }
    };
  });
}

/**
 * Получить все файлы из директории рекурсивно
 */
export async function getAllFilesFromDirectory(
  directoryHandle: DirectoryHandle,
  supportedFormats: string[] = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.webm']
): Promise<FileHandle[]> {
  const files: FileHandle[] = [];
  
  async function scanDirectory(dirHandle: DirectoryHandle, path: string = '') {
    try {
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          // Проверяем расширение файла
          const fileName = entry.name.toLowerCase();
          const hasValidExtension = supportedFormats.some(ext => fileName.endsWith(ext));
          
          if (hasValidExtension) {
            files.push(entry as FileHandle);
          }
        } else if (entry.kind === 'directory') {
          // Рекурсивно сканируем подпапки
          // Пропускаем служебные папки
          if (!entry.name.startsWith('.') && !entry.name.startsWith('_')) {
            await scanDirectory(entry as DirectoryHandle, `${path}/${entry.name}`);
          }
        }
      }
    } catch (error) {
      console.error('Ошибка сканирования директории:', error);
    }
  }
  
  await scanDirectory(directoryHandle);
  return files;
}

/**
 * Прочитать файл как Blob
 */
export async function readFileAsBlob(fileHandle: FileHandle): Promise<Blob> {
  try {
    const file = await fileHandle.getFile();
    return file;
  } catch (error) {
    console.error('Ошибка чтения файла:', error);
    throw error;
  }
}

/**
 * Прочитать файл как Data URL
 */
export async function readFileAsDataURL(fileHandle: FileHandle): Promise<string> {
  try {
    const file = await fileHandle.getFile();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  } catch (error) {
    console.error('Ошибка чтения файла как Data URL:', error);
    throw error;
  }
}

/**
 * Получить информацию о файле
 */
export async function getFileInfo(fileHandle: FileHandle): Promise<{
  name: string;
  size: number;
  type: string;
  lastModified: number;
}> {
  try {
    const file = await fileHandle.getFile();
    return {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    };
  } catch (error) {
    console.error('Ошибка получения информации о файле:', error);
    throw error;
  }
}

/**
 * Создать файл в директории
 */
export async function createFile(
  directoryHandle: DirectoryHandle,
  fileName: string,
  content: Blob | string
): Promise<FileHandle> {
  try {
    // Проверяем разрешения
    const hasPermission = await verifyDirectoryPermission(directoryHandle, 'readwrite');
    if (!hasPermission) {
      throw new Error('Нет разрешения на запись в директорию');
    }

    // Создаём файл
    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
    
    // Записываем содержимое
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    
    return fileHandle;
  } catch (error) {
    console.error('Ошибка создания файла:', error);
    throw error;
  }
}

/**
 * Удалить файл из директории
 */
export async function deleteFile(
  directoryHandle: DirectoryHandle,
  fileName: string
): Promise<void> {
  try {
    // Проверяем разрешения
    const hasPermission = await verifyDirectoryPermission(directoryHandle, 'readwrite');
    if (!hasPermission) {
      throw new Error('Нет разрешения на удаление из директории');
    }

    await directoryHandle.removeEntry(fileName);
  } catch (error) {
    console.error('Ошибка удаления файла:', error);
    throw error;
  }
}

/**
 * Получить handle подпапки или создать её
 */
export async function getOrCreateSubdirectory(
  directoryHandle: DirectoryHandle,
  subdirectoryName: string
): Promise<DirectoryHandle> {
  try {
    // Проверяем разрешения
    const hasPermission = await verifyDirectoryPermission(directoryHandle, 'readwrite');
    if (!hasPermission) {
      throw new Error('Нет разрешения на создание директории');
    }

    return await directoryHandle.getDirectoryHandle(subdirectoryName, { create: true });
  } catch (error) {
    console.error('Ошибка создания поддиректории:', error);
    throw error;
  }
}

/**
 * Экспортировать файлы в выбранную папку
 */
export async function exportFiles(
  files: { name: string; blob: Blob }[]
): Promise<boolean> {
  try {
    if (!isFileSystemSupported()) {
      throw new Error('File System Access API не поддерживается');
    }

    // Запрашиваем папку для экспорта
    const directoryHandle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'downloads'
    });

    // Проверяем разрешения
    const hasPermission = await verifyDirectoryPermission(directoryHandle, 'readwrite');
    if (!hasPermission) {
      throw new Error('Нет разрешения на запись');
    }

    // Экспортируем файлы
    for (const file of files) {
      await createFile(directoryHandle, file.name, file.blob);
    }

    return true;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.log('Экспорт отменён пользователем');
      return false;
    }
    console.error('Ошибка экспорта файлов:', error);
    throw error;
  }
}

/**
 * Получить статистику директории
 */
export async function getDirectoryStats(
  directoryHandle: DirectoryHandle
): Promise<{
  totalFiles: number;
  imageFiles: number;
  videoFiles: number;
  totalSize: number;
}> {
  const imageFormats = ['.jpg', '.jpeg', '.png', '.webp'];
  const videoFormats = ['.mp4', '.webm'];
  const allFormats = [...imageFormats, ...videoFormats];
  
  const files = await getAllFilesFromDirectory(directoryHandle, allFormats);
  
  let totalSize = 0;
  let imageCount = 0;
  let videoCount = 0;
  
  for (const fileHandle of files) {
    const file = await fileHandle.getFile();
    totalSize += file.size;
    
    const fileName = file.name.toLowerCase();
    if (imageFormats.some(ext => fileName.endsWith(ext))) {
      imageCount++;
    } else if (videoFormats.some(ext => fileName.endsWith(ext))) {
      videoCount++;
    }
  }
  
  return {
    totalFiles: files.length,
    imageFiles: imageCount,
    videoFiles: videoCount,
    totalSize
  };
}

/**
 * Очистить сохранённые handles
 */
export async function clearSavedHandles(): Promise<void> {
  try {
    const db = await openHandleDB();
    const transaction = db.transaction(['handles'], 'readwrite');
    const store = transaction.objectStore('handles');
    await store.clear();
  } catch (error) {
    console.error('Ошибка очистки handles:', error);
    throw error;
  }
}

export default {
  isFileSystemSupported,
  requestWorkingDirectory,
  verifyDirectoryPermission,
  getSavedDirectoryHandle,
  getAllFilesFromDirectory,
  readFileAsBlob,
  readFileAsDataURL,
  getFileInfo,
  createFile,
  deleteFile,
  getOrCreateSubdirectory,
  exportFiles,
  getDirectoryStats,
  clearSavedHandles
};

