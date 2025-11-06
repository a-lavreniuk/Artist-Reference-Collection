/**
 * Модуль автообновлений через electron-updater
 */

import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';

let mainWindow: BrowserWindow | null = null;

/**
 * Инициализация автообновлений
 * @param window - главное окно приложения
 */
export function initializeAutoUpdater(window: BrowserWindow): void {
  mainWindow = window;

  // Настройка автообновлений
  autoUpdater.autoDownload = false; // Не загружаем автоматически
  autoUpdater.autoInstallOnAppQuit = true; // Устанавливаем при выходе

  // Проверяем обновления при запуске (через 3 секунды после старта)
  setTimeout(() => {
    checkForUpdates();
  }, 3000);

  // Периодическая проверка каждые 4 часа
  setInterval(() => {
    checkForUpdates();
  }, 4 * 60 * 60 * 1000);

  // === События автообновлений ===

  /**
   * Обновление доступно
   */
  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Доступно обновление:', info.version);
    // Отправляем событие в renderer
    mainWindow?.webContents.send('update-available');
  });

  /**
   * Обновление не доступно
   */
  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] Обновлений нет');
  });

  /**
   * Ошибка при проверке обновлений
   */
  autoUpdater.on('error', (error) => {
    console.error('[AutoUpdater] Ошибка:', error);
  });

  /**
   * Прогресс загрузки обновления
   */
  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent);
    console.log(`[AutoUpdater] Загрузка: ${percent}%`);
  });

  /**
   * Обновление загружено и готово к установке
   */
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Обновление загружено:', info.version);
    // Отправляем событие в renderer
    mainWindow?.webContents.send('update-ready');
  });

  console.log('[AutoUpdater] Инициализирован');
}

/**
 * Проверить наличие обновлений
 */
export async function checkForUpdates(): Promise<void> {
  try {
    console.log('[AutoUpdater] Проверка обновлений...');
    await autoUpdater.checkForUpdates();
  } catch (error) {
    console.error('[AutoUpdater] Ошибка проверки обновлений:', error);
  }
}

/**
 * Загрузить обновление
 */
export async function downloadUpdate(): Promise<void> {
  try {
    console.log('[AutoUpdater] Загрузка обновления...');
    await autoUpdater.downloadUpdate();
  } catch (error) {
    console.error('[AutoUpdater] Ошибка загрузки обновления:', error);
  }
}

/**
 * Установить загруженное обновление и перезапустить приложение
 */
export function installUpdate(): void {
  console.log('[AutoUpdater] Установка обновления...');
  autoUpdater.quitAndInstall(false, true);
}

