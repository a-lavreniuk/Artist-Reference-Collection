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
   * Открыть диалог выбора пути для сохранения backup
   * @param defaultFileName - Имя файла по умолчанию
   * @returns Путь для сохранения или undefined если отменено
   */
  selectBackupPath: (defaultFileName: string) => Promise<string | undefined>;
  
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
  
  // === СИСТЕМНЫЕ ОПЕРАЦИИ ===
  
  /**
   * Открыть папку с файлом в проводнике
   * @param filePath - Путь к файлу
   * @returns true если успешно
   */
  openFileLocation: (filePath: string) => Promise<boolean>;
  
  /**
   * Экспортировать файл в выбранную папку
   * @param sourcePath - Путь к исходному файлу
   * @param defaultFileName - Имя файла по умолчанию
   * @returns Путь к экспортированному файлу или null если отменено
   */
  exportFile: (sourcePath: string, defaultFileName: string) => Promise<string | null>;
  
  /**
   * Скопировать текст в буфер обмена
   * @param text - Текст для копирования
   * @returns true если успешно
   */
  copyToClipboard: (text: string) => Promise<boolean>;
  
  /**
   * Удалить файл с диска
   * @param filePath - Путь к файлу
   * @returns true если успешно
   */
  deleteFile: (filePath: string) => Promise<boolean>;
  
  /**
   * Получить информацию о размерах файлов в рабочей папке
   * @param workingDir - Рабочая директория
   * @returns Объект с размерами файлов
   */
  getDirectorySize: (workingDir: string) => Promise<{
    totalSize: number;
    imagesSize: number;
    videosSize: number;
    cacheSize: number;
    imageCount: number;
    videoCount: number;
  }>;
  
  /**
   * Переместить рабочую папку в новое место
   * Копирует все файлы из старой папки в новую
   * @param oldDir - Старая рабочая папка
   * @param newDir - Новая рабочая папка
   * @returns Результат переноса
   */
  moveWorkingDirectory: (oldDir: string, newDir: string) => Promise<{
    success: boolean;
    copiedFiles: number;
  }>;
  
  /**
   * Подписаться на событие прогресса переноса папки
   * @param callback - Функция обратного вызова с данными о прогрессе
   */
  onMoveDirectoryProgress: (callback: (data: { percent: number; copied: number; total: number }) => void) => void;
  
  /**
   * Экспортировать мудборд в отдельную папку
   * @param filePaths - Массив путей к файлам для экспорта
   * @param targetDir - Целевая папка для экспорта
   * @returns Результат экспорта
   */
  exportMoodboard: (filePaths: string[], targetDir: string) => Promise<{
    success: boolean;
    copiedCount: number;
    failedCount: number;
    failedFiles: string[];
  }>;
  
  /**
   * Подписаться на событие прогресса экспорта
   * @param callback - Функция обратного вызова с данными о прогрессе
   */
  onExportProgress: (callback: (data: { percent: number; copied: number; total: number }) => void) => void;
  
  // === РЕЗЕРВНОЕ КОПИРОВАНИЕ ===
  
  /**
   * Создать резервную копию данных
   * @param outputPath - Путь для сохранения архива
   * @param workingDir - Рабочая директория
   * @param parts - Количество частей архива (1, 2, 4, 8)
   * @returns Информация о созданном бэкапе
   */
  createBackup: (outputPath: string, workingDir: string, parts: number, databaseJson: string) => Promise<{
    success: boolean;
    size: number;
    filesCount: number;
    duration?: number;
    manifest?: any;
  }>;
  
  /**
   * Подписаться на прогресс создания backup
   * @param callback - Функция обратного вызова с данными прогресса
   */
  onBackupProgress: (callback: (data: { percent: number; processed: number; total: number }) => void) => void;
  
  /**
   * Восстановить данные из резервной копии
   * @param archivePath - Путь к архиву (или к первой части)
   * @param targetDir - Целевая директория
   * @returns Успешность восстановления и JSON базы данных
   */
  restoreBackup: (archivePath: string, targetDir: string) => Promise<{
    success: boolean;
    databaseJson: string | null;
  }>;
  
  /**
   * Открыть диалог выбора архива для восстановления
   * @returns Путь к выбранному архиву или undefined если отменено
   */
  selectArchivePath: () => Promise<string | undefined>;
  
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
  selectBackupPath: (defaultFileName: string) => ipcRenderer.invoke('select-backup-path', defaultFileName),
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
  
  // Системные операции
  openFileLocation: (filePath: string) => ipcRenderer.invoke('open-file-location', filePath),
  exportFile: (sourcePath: string, defaultFileName: string) => 
    ipcRenderer.invoke('export-file', sourcePath, defaultFileName),
  copyToClipboard: (text: string) => ipcRenderer.invoke('copy-to-clipboard', text),
  deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),
  getDirectorySize: (workingDir: string) => ipcRenderer.invoke('get-directory-size', workingDir),
  moveWorkingDirectory: (oldDir: string, newDir: string) => ipcRenderer.invoke('move-working-directory', oldDir, newDir),
  onMoveDirectoryProgress: (callback: (data: { percent: number; copied: number; total: number }) => void) => {
    ipcRenderer.on('move-directory-progress', (_event, data) => callback(data));
  },
  exportMoodboard: (filePaths: string[], targetDir: string) => 
    ipcRenderer.invoke('export-moodboard', filePaths, targetDir),
  onExportProgress: (callback: (data: { percent: number; copied: number; total: number }) => void) => {
    ipcRenderer.on('export-progress', (_event, data) => callback(data));
  },
  
  // Резервное копирование
  createBackup: (outputPath: string, workingDir: string, parts: number, databaseJson: string) => 
    ipcRenderer.invoke('create-backup', outputPath, workingDir, parts, databaseJson),
  onBackupProgress: (callback: (data: { percent: number; processed: number; total: number }) => void) => {
    ipcRenderer.on('backup-progress', (_event, data) => callback(data));
  },
  restoreBackup: (archivePath: string, targetDir: string) => 
    ipcRenderer.invoke('restore-backup', archivePath, targetDir),
  selectArchivePath: () => ipcRenderer.invoke('select-archive-path'),
  
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

