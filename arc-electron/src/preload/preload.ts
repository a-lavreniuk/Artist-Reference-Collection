/**
 * Preload скрипт для безопасного моста между main и renderer процессами
 * Предоставляет API для работы с файловой системой и системными функциями
 */

import { contextBridge, ipcRenderer } from 'electron';

/**
 * Интерфейс API для renderer процесса
 */
export interface ElectronAPI {
  // === ФАЙЛОВАЯ СИСТЕМА ===
  
  /**
   * Открыть диалог выбора рабочей папки
   * @returns Путь к выбранной папке или undefined если отменено
   */
  selectWorkingDirectory: () => Promise<string | undefined>;
  
  /**
   * Сканировать директорию и получить список медиафайлов
   * @param dirPath - Путь к папке для сканирования
   * @returns Массив путей к файлам
   */
  scanDirectory: (dirPath: string) => Promise<string[]>;
  
  /**
   * Получить информацию о файле
   * @param filePath - Путь к файлу
   * @returns Метаданные файла (размер, даты создания/модификации)
   */
  getFileInfo: (filePath: string) => Promise<{
    name: string;
    size: number;
    created: Date;
    modified: Date;
  }>;
  
  /**
   * Проверить существование файла
   * @param filePath - Путь к файлу
   * @returns true если файл существует
   */
  fileExists: (filePath: string) => Promise<boolean>;
  
  /**
   * Скопировать файл в рабочую папку с организацией по дате
   * @param sourcePath - Путь к исходному файлу
   * @param workingDir - Рабочая директория
   * @returns Путь к скопированному файлу
   */
  organizeFile: (sourcePath: string, workingDir: string) => Promise<string>;
  
  /**
   * Сохранить файл из ArrayBuffer в рабочую папку
   * @param buffer - Данные файла как ArrayBuffer
   * @param fileName - Имя файла
   * @param workingDir - Рабочая директория
   * @returns Путь к сохранённому файлу
   */
  saveFileFromBuffer: (buffer: ArrayBuffer, fileName: string, workingDir: string) => Promise<string>;
  
  /**
   * Создать превью для изображения или видео
   * @param filePath - Путь к файлу
   * @param workingDir - Рабочая директория
   * @returns Путь к созданному превью
   */
  generateThumbnail: (filePath: string, workingDir: string) => Promise<string>;
  
  /**
   * Получить URL для локального файла (file://)
   * @param filePath - Путь к файлу
   * @returns file:// URL
   */
  getFileURL: (filePath: string) => Promise<string>;
  
  // === РЕЗЕРВНОЕ КОПИРОВАНИЕ ===
  
  /**
   * Создать резервную копию данных
   * @param outputPath - Путь для сохранения архива
   * @param workingDir - Рабочая директория
   * @param parts - Количество частей архива (1, 2, 4, 8)
   * @returns Информация о созданном бэкапе
   */
  createBackup: (outputPath: string, workingDir: string, parts: number) => Promise<{
    success: boolean;
    size: number;
    filesCount: number;
  }>;
  
  /**
   * Восстановить данные из резервной копии
   * @param archivePath - Путь к архиву
   * @param targetDir - Целевая директория
   * @returns Успешность восстановления
   */
  restoreBackup: (archivePath: string, targetDir: string) => Promise<boolean>;
  
  // === СИСТЕМНЫЕ ФУНКЦИИ ===
  
  /**
   * Показать уведомление
   * @param title - Заголовок
   * @param body - Текст уведомления
   */
  showNotification: (title: string, body: string) => Promise<void>;
  
  /**
   * Получить версию приложения
   * @returns Версия приложения
   */
  getAppVersion: () => Promise<string>;
  
  /**
   * Проверить наличие обновлений
   */
  checkForUpdates: () => Promise<void>;
  
  // === СОБЫТИЯ ===
  
  /**
   * Подписаться на событие обновления
   * @param callback - Функция обратного вызова
   */
  onUpdateAvailable: (callback: () => void) => void;
  
  /**
   * Подписаться на событие готовности обновления
   * @param callback - Функция обратного вызова
   */
  onUpdateReady: (callback: () => void) => void;
  
  /**
   * Установить загруженное обновление
   */
  installUpdate: () => Promise<void>;
}

/**
 * Экспонируем безопасный API в renderer процесс
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // Файловая система
  selectWorkingDirectory: () => ipcRenderer.invoke('select-working-directory'),
  scanDirectory: (dirPath: string) => ipcRenderer.invoke('scan-directory', dirPath),
  getFileInfo: (filePath: string) => ipcRenderer.invoke('get-file-info', filePath),
  fileExists: (filePath: string) => ipcRenderer.invoke('file-exists', filePath),
  organizeFile: (sourcePath: string, workingDir: string) => 
    ipcRenderer.invoke('organize-file', sourcePath, workingDir),
  saveFileFromBuffer: (buffer: ArrayBuffer, fileName: string, workingDir: string) => 
    ipcRenderer.invoke('save-file-from-buffer', Buffer.from(buffer), fileName, workingDir),
  generateThumbnail: (filePath: string, workingDir: string) => 
    ipcRenderer.invoke('generate-thumbnail', filePath, workingDir),
  getFileURL: (filePath: string) => ipcRenderer.invoke('get-file-url', filePath),
  
  // Резервное копирование
  createBackup: (outputPath: string, workingDir: string, parts: number) => 
    ipcRenderer.invoke('create-backup', outputPath, workingDir, parts),
  restoreBackup: (archivePath: string, targetDir: string) => 
    ipcRenderer.invoke('restore-backup', archivePath, targetDir),
  
  // Системные функции
  showNotification: (title: string, body: string) => 
    ipcRenderer.invoke('show-notification', title, body),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  // События
  onUpdateAvailable: (callback: () => void) => {
    ipcRenderer.on('update-available', callback);
  },
  onUpdateReady: (callback: () => void) => {
    ipcRenderer.on('update-ready', callback);
  },
  installUpdate: () => ipcRenderer.invoke('install-update')
} as ElectronAPI);

console.log('[PRELOAD] Electron API успешно подключен');

