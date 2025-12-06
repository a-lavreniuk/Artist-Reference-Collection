/**
 * Менеджер загрузки файлов из браузера через протокол arc://
 * Singleton класс для управления загрузками изображений из браузерного расширения
 */

import { BrowserWindow } from 'electron';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { URL } from 'url';

/**
 * Менеджер загрузки файлов
 */
export class DownloadManager {
  private static instance: DownloadManager;
  private workingDirectory: string | null = null;
  private mainWindow: BrowserWindow | null = null;
  private tempDir: string | null = null;

  /**
   * Приватный конструктор для Singleton паттерна
   */
  private constructor() {}

  /**
   * Получить единственный экземпляр класса
   */
  public static getInstance(): DownloadManager {
    if (!DownloadManager.instance) {
      DownloadManager.instance = new DownloadManager();
    }
    return DownloadManager.instance;
  }

  /**
   * Установить рабочую директорию
   * Создает папку _cache/imports если её нет
   */
  public async setWorkingDirectory(dirPath: string): Promise<void> {
    console.log('[DownloadManager] Установка рабочей директории:', dirPath);
    this.workingDirectory = dirPath;
    
    // Создаем папку для временных импортов
    this.tempDir = path.join(dirPath, '_cache', 'imports');
    
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      console.log('[DownloadManager] Папка импорта создана:', this.tempDir);
    } catch (error) {
      console.error('[DownloadManager] Ошибка создания папки импорта:', error);
    }
  }

  /**
   * Установить главное окно приложения
   */
  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
    console.log('[DownloadManager] Главное окно установлено');
  }

  /**
   * Получить путь к временной папке импорта
   */
  public getTempDir(): string | null {
    return this.tempDir;
  }

  /**
   * Скачать файл из URL
   * @param url - URL файла для скачивания
   * @param source - Опциональный источник (URL страницы откуда скачивается)
   */
  public async downloadFile(url: string, source?: string): Promise<void> {
    console.log('[DownloadManager] Начало загрузки:', url);
    console.log('[DownloadManager] Источник:', source || 'неизвестен');

    if (!this.tempDir) {
      console.error('[DownloadManager] Рабочая директория не установлена');
      throw new Error('Working directory not set');
    }

    try {
      // Создаем папку если её нет
      await fs.mkdir(this.tempDir, { recursive: true });

      // Генерируем уникальное имя файла (timestamp + random для уникальности)
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 9);
      const parsedUrl = new URL(url);
      const extension = path.extname(parsedUrl.pathname) || '.jpg';
      const fileName = `import_${timestamp}_${random}${extension}`;
      const filePath = path.join(this.tempDir, fileName);

      console.log('[DownloadManager] Сохранение в:', filePath);

      // Скачиваем файл
      await this.downloadToFile(url, filePath);

      console.log('[DownloadManager] Файл успешно загружен');

      // Отправляем событие в renderer процесс
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        const eventData = {
          filePath: filePath,
          sourceUrl: source,
          originalUrl: url,
          timestamp: timestamp
        };
        console.log('[DownloadManager] Отправка события в renderer:', eventData);
        this.mainWindow.webContents.send('main:external-file-downloaded', eventData);
        console.log('[DownloadManager] Событие успешно отправлено');
      } else {
        console.error('[DownloadManager] Не удалось отправить событие: окно не доступно');
      }
    } catch (error) {
      console.error('[DownloadManager] Ошибка загрузки файла:', error);
      throw error;
    }
  }

  /**
   * Скачать файл по URL и сохранить на диск
   */
  private downloadToFile(url: string, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const request = protocol.get(url, {
        timeout: 60000, // 60 секунд таймаут для больших файлов
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      }, (response) => {
        // Обработка редиректов
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            console.log('[DownloadManager] Редирект на:', redirectUrl);
            this.downloadToFile(redirectUrl, filePath).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        // Создаем поток записи
        const fileStream = fsSync.createWriteStream(filePath);
        
        let downloadedBytes = 0;
        const totalBytes = parseInt(response.headers['content-length'] || '0', 10);

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0) {
            const percent = Math.round((downloadedBytes / totalBytes) * 100);
            if (percent % 10 === 0) {
              console.log(`[DownloadManager] Прогресс: ${percent}%`);
            }
          }
        });

        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          console.log('[DownloadManager] Загрузка завершена:', filePath);
          resolve();
        });

        fileStream.on('error', async (error) => {
          // Закрываем stream перед удалением
          fileStream.close();
          // Удаляем неполный файл (теперь с await для гарантии удаления)
          try {
            await fs.unlink(filePath);
            console.log('[DownloadManager] Неполный файл удален:', filePath);
          } catch (unlinkError) {
            console.error('[DownloadManager] Ошибка удаления неполного файла:', unlinkError);
          }
          reject(error);
        });
      });

      request.on('error', async (error) => {
        // При ошибке запроса также пытаемся удалить частично загруженный файл
        try {
          await fs.unlink(filePath);
        } catch {
          // Игнорируем, файл может еще не существовать
        }
        reject(error);
      });

      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Download timeout'));
      });
    });
  }

  /**
   * Очистить старые файлы из папки импорта
   * Удаляет файлы старше 7 дней
   */
  public async cleanupOldFiles(): Promise<void> {
    if (!this.tempDir) {
      console.log('[DownloadManager] Папка импорта не установлена, пропуск очистки');
      return;
    }

    console.log('[DownloadManager] Начало очистки старых файлов...');

    try {
      // Проверяем существование папки
      try {
        await fs.access(this.tempDir);
      } catch {
        console.log('[DownloadManager] Папка импорта не существует');
        return;
      }

      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 дней в миллисекундах
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        
        try {
          const stats = await fs.stat(filePath);
          const fileAge = now - stats.mtimeMs;

          if (fileAge > maxAge) {
            await fs.unlink(filePath);
            deletedCount++;
            console.log('[DownloadManager] Удален старый файл:', file);
          }
        } catch (error) {
          console.error(`[DownloadManager] Ошибка обработки файла ${file}:`, error);
        }
      }

      console.log(`[DownloadManager] Очистка завершена. Удалено файлов: ${deletedCount}`);
    } catch (error) {
      console.error('[DownloadManager] Ошибка очистки файлов:', error);
    }
  }

  /**
   * Получить статистику временной папки
   */
  public async getStats(): Promise<{ count: number; totalSize: number }> {
    if (!this.tempDir) {
      return { count: 0, totalSize: 0 };
    }

    try {
      const files = await fs.readdir(this.tempDir);
      let totalSize = 0;

      for (const file of files) {
        try {
          const filePath = path.join(this.tempDir, file);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
        } catch {
          // Игнорируем ошибки отдельных файлов
        }
      }

      return { count: files.length, totalSize };
    } catch {
      return { count: 0, totalSize: 0 };
    }
  }
}






