/**
 * Обработчики IPC событий для коммуникации между main и renderer процессами
 * Здесь регистрируются все handlers для работы с файловой системой и системными функциями
 */

import { ipcMain, dialog, Notification, app } from 'electron';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import archiver from 'archiver';

// Настраиваем путь к ffmpeg бинарнику
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Регистрация всех IPC handlers
 * Вызывается при инициализации приложения
 */
export function registerIPCHandlers(): void {
  console.log('[IPC] Регистрация IPC handlers...');

  // === ФАЙЛОВАЯ СИСТЕМА ===

  /**
   * Открыть диалог выбора рабочей папки
   */
  ipcMain.handle('select-working-directory', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Выберите рабочую папку для ARC',
        buttonLabel: 'Выбрать папку'
      });

      if (result.canceled || result.filePaths.length === 0) {
        console.log('[IPC] Выбор папки отменён');
        return undefined;
      }

      const selectedPath = result.filePaths[0];
      console.log('[IPC] Выбрана папка:', selectedPath);
      return selectedPath;
    } catch (error) {
      console.error('[IPC] Ошибка выбора папки:', error);
      throw error;
    }
  });

  /**
   * Открыть диалог выбора пути для сохранения backup
   */
  ipcMain.handle('select-backup-path', async (_event, defaultFileName: string) => {
    try {
      const result = await dialog.showSaveDialog({
        title: 'Сохранить резервную копию',
        defaultPath: defaultFileName,
        filters: [
          { name: 'ZIP архивы', extensions: ['zip'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        console.log('[IPC] Выбор пути отменён');
        return undefined;
      }

      console.log('[IPC] Выбран путь для backup:', result.filePath);
      return result.filePath;
    } catch (error) {
      console.error('[IPC] Ошибка выбора пути:', error);
      throw error;
    }
  });

  /**
   * Сканировать директорию и получить список медиафайлов
   */
  ipcMain.handle('scan-directory', async (_event, dirPath: string) => {
    try {
      console.log('[IPC] Сканирование директории:', dirPath);
      const supportedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.webm'];
      const files: string[] = [];

      /**
       * Рекурсивное сканирование папки
       */
      async function scanDir(currentPath: string): Promise<void> {
        try {
          const entries = await fs.readdir(currentPath, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);

            if (entry.isDirectory()) {
              // Пропускаем служебные папки
              if (!entry.name.startsWith('.') && !entry.name.startsWith('_')) {
                await scanDir(fullPath);
              }
            } else if (entry.isFile()) {
              // Проверяем расширение файла
              const ext = path.extname(entry.name).toLowerCase();
              if (supportedExtensions.includes(ext)) {
                files.push(fullPath);
              }
            }
          }
        } catch (err) {
          console.error(`[IPC] Ошибка сканирования ${currentPath}:`, err);
        }
      }

      await scanDir(dirPath);
      console.log(`[IPC] Найдено файлов: ${files.length}`);
      return files;
    } catch (error) {
      console.error('[IPC] Ошибка сканирования:', error);
      throw error;
    }
  });

  /**
   * Получить информацию о файле
   */
  ipcMain.handle('get-file-info', async (_event, filePath: string) => {
    try {
      const stats = await fs.stat(filePath);
      const fileName = path.basename(filePath);

      return {
        name: fileName,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };
    } catch (error) {
      console.error('[IPC] Ошибка получения информации о файле:', error);
      throw error;
    }
  });

  /**
   * Проверить существование файла
   */
  ipcMain.handle('file-exists', async (_event, filePath: string) => {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  });

  /**
   * Скопировать файл в рабочую папку с организацией по дате
   */
  ipcMain.handle('organize-file', async (_event, sourcePath: string, workingDir: string) => {
    try {
      console.log('[IPC] Организация файла:', sourcePath);

      // Создаём структуру папок год/месяц/день
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');

      const targetDir = path.join(workingDir, year, month, day);
      await fs.mkdir(targetDir, { recursive: true });

      // Копируем файл
      const fileName = path.basename(sourcePath);
      const targetPath = path.join(targetDir, fileName);

      // Если файл с таким именем уже существует, добавляем timestamp
      let finalPath = targetPath;
      let counter = 1;
      while (await fileExists(finalPath)) {
        const ext = path.extname(fileName);
        const nameWithoutExt = path.basename(fileName, ext);
        finalPath = path.join(targetDir, `${nameWithoutExt}_${counter}${ext}`);
        counter++;
      }

      await fs.copyFile(sourcePath, finalPath);
      console.log('[IPC] Файл скопирован в:', finalPath);

      return finalPath;
    } catch (error) {
      console.error('[IPC] Ошибка организации файла:', error);
      throw error;
    }
  });

  /**
   * Сохранить файл из ArrayBuffer в рабочую папку с организацией по дате
   */
  ipcMain.handle('save-file-from-buffer', async (_event, buffer: Buffer, fileName: string, workingDir: string) => {
    try {
      console.log('[IPC] Сохранение файла из буфера:', fileName);

      // Создаём структуру папок год/месяц/день
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');

      const targetDir = path.join(workingDir, year, month, day);
      await fs.mkdir(targetDir, { recursive: true });
      console.log('[IPC] Создана директория:', targetDir);

      // Сохраняем файл
      let targetPath = path.join(targetDir, fileName);
      
      // Если файл с таким именем уже существует, добавляем счётчик
      let counter = 1;
      while (await fileExists(targetPath)) {
        const ext = path.extname(fileName);
        const nameWithoutExt = path.basename(fileName, ext);
        targetPath = path.join(targetDir, `${nameWithoutExt}_${counter}${ext}`);
        counter++;
      }

      await fs.writeFile(targetPath, buffer);
      console.log('[IPC] Файл сохранён:', targetPath);

      return targetPath;
    } catch (error) {
      console.error('[IPC] Ошибка сохранения файла из буфера:', error);
      throw error;
    }
  });

  /**
   * Создать превью для изображения или видео
   * Для изображений - sharp (512px по широкой стороне)
   * Для видео - пока копия оригинала (TODO: ffmpeg)
   */
  ipcMain.handle('generate-thumbnail', async (_event, filePath: string, workingDir: string) => {
    try {
      console.log('[IPC] Генерация превью для:', filePath);

      // Создаём папку для превью
      const thumbsDir = path.join(workingDir, '_cache', 'thumbs');
      await fs.mkdir(thumbsDir, { recursive: true });

      // Генерируем имя для превью
      const ext = path.extname(filePath).toLowerCase();
      const isVideo = ['.mp4', '.webm'].includes(ext);
      const fileName = path.basename(filePath, ext);
      const thumbName = `${fileName}_thumb.jpg`;
      const thumbPath = path.join(thumbsDir, thumbName);

      if (isVideo) {
        // Генерируем превью для видео через ffmpeg
        console.log('[IPC] Генерация превью для видео через ffmpeg...');
        
        await new Promise<void>((resolve, reject) => {
          ffmpeg(filePath)
            .screenshots({
              count: 1,
              folder: thumbsDir,
              filename: thumbName,
              size: '512x?', // 512px по ширине, высота автоматически
              timemarks: ['00:00:01.000'] // Кадр на 1-й секунде
            })
            .on('end', () => {
              console.log('[IPC] Превью видео создано:', thumbPath);
              resolve();
            })
            .on('error', (err) => {
              console.error('[IPC] Ошибка генерации превью видео:', err);
              // Если не удалось создать превью, возвращаем путь к несуществующему файлу
              // UI покажет placeholder
              resolve();
            });
        });

        // Проверяем, создалось ли превью
        const thumbExists = await fileExists(thumbPath);
        if (thumbExists) {
          const thumbStats = await fs.stat(thumbPath);
          const originalStats = await fs.stat(filePath);
          const compressionRatio = Math.round((1 - thumbStats.size / originalStats.size) * 100);
          console.log(`[IPC] Размер превью видео: ${Math.round(thumbStats.size / 1024)}KB (сжатие ${compressionRatio}%)`);
        } else {
          console.log('[IPC] Превью видео не создано, будет показан placeholder');
        }
      } else {
        // Генерируем превью для изображения через sharp
        // 512px по широкой стороне, сохраняя пропорции
        await sharp(filePath)
          .resize(512, 512, {
            fit: 'inside', // Вписать внутрь, сохраняя пропорции
            withoutEnlargement: true // Не увеличивать если меньше 512px
          })
          .jpeg({
            quality: 85, // Хорошее качество
            progressive: true // Progressive JPEG для быстрой загрузки
          })
          .toFile(thumbPath);

        console.log('[IPC] Превью создано:', thumbPath);
        
        // Получаем размер превью
        const thumbStats = await fs.stat(thumbPath);
        const originalStats = await fs.stat(filePath);
        const compressionRatio = Math.round((1 - thumbStats.size / originalStats.size) * 100);
        console.log(`[IPC] Размер превью: ${Math.round(thumbStats.size / 1024)}KB (сжатие ${compressionRatio}%)`);
      }

      return thumbPath;
    } catch (error) {
      console.error('[IPC] Ошибка генерации превью:', error);
      throw error;
    }
  });

  /**
   * Получить file:// URL для локального файла
   * Читает файл и возвращает как Data URL (base64)
   */
  ipcMain.handle('get-file-url', async (_event, filePath: string) => {
    try {
      console.log('[IPC] Чтение файла для Data URL:', filePath);
      
      // Читаем файл
      const fileBuffer = await fs.readFile(filePath);
      
      // Определяем MIME тип по расширению
      const ext = path.extname(filePath).toLowerCase();
      let mimeType = 'image/jpeg';
      
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';
      else if (ext === '.mp4') mimeType = 'video/mp4';
      else if (ext === '.webm') mimeType = 'video/webm';
      
      // Конвертируем в base64 Data URL
      const base64 = fileBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      console.log('[IPC] Data URL создан, размер:', Math.round(base64.length / 1024), 'KB');
      return dataUrl;
    } catch (error) {
      console.error('[IPC] Ошибка чтения файла:', error);
      throw error;
    }
  });

  // === РЕЗЕРВНОЕ КОПИРОВАНИЕ ===

  /**
   * Создать резервную копию данных
   * Создаёт ZIP архив с содержимым рабочей папки + база данных
   */
  ipcMain.handle('create-backup', async (event, outputPath: string, workingDir: string, parts: number, databaseJson: string) => {
    try {
      console.log('[IPC] Создание резервной копии...');
      console.log('[IPC] Выходной путь:', outputPath);
      console.log('[IPC] Рабочая директория:', workingDir);
      console.log('[IPC] Количество частей:', parts);

      // 1. Проверка доступности рабочей директории
      try {
        await fs.access(workingDir);
      } catch {
        throw new Error('Рабочая директория недоступна');
      }

      // 2. Подсчёт размера рабочей папки
      let totalSize = 0;
      let filesCount = 0;

      async function calculateSize(dir: string): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await calculateSize(fullPath);
          } else if (entry.isFile()) {
            const stats = await fs.stat(fullPath);
            totalSize += stats.size;
            filesCount++;
          }
        }
      }

      await calculateSize(workingDir);
      console.log(`[IPC] Размер рабочей папки: ${Math.round(totalSize / 1024 / 1024)} MB, файлов: ${filesCount}`);

      // 3. Создание архива
      const archiveName = path.basename(outputPath);
      const archiveDir = path.dirname(outputPath);
      
      // Создаём выходную директорию если не существует
      await fs.mkdir(archiveDir, { recursive: true });

      return new Promise((resolve, reject) => {
        const output = fsSync.createWriteStream(outputPath);
        const archive = archiver('zip', {
          zlib: { level: 9 } // Максимальное сжатие
        });

        let processedSize = 0;
        const startTime = Date.now();

        // Обработка событий
        output.on('close', async () => {
          const archiveSize = archive.pointer();
          const duration = Math.round((Date.now() - startTime) / 1000);
          
          console.log(`[IPC] Архив создан: ${Math.round(archiveSize / 1024 / 1024)} MB`);
          console.log(`[IPC] Время создания: ${duration} сек`);
          
          // Разбиваем на части если нужно
          let finalPaths: string[] = [outputPath];
          if (parts > 1) {
            try {
              finalPaths = await splitFile(outputPath, parts);
              console.log(`[IPC] Файл разбит на ${parts} частей`);
            } catch (splitError) {
              console.error('[IPC] Ошибка разбиения на части:', splitError);
              // Продолжаем с одним файлом
            }
          }
          
          // Создаём manifest.json
          const manifest = {
            version: '1.0',
            date: new Date().toISOString(),
            workingDir: workingDir,
            totalSize: archiveSize,
            filesCount: filesCount,
            parts: parts,
            archiveName: parts > 1 ? path.basename(finalPaths[0]) : archiveName,
            partFiles: finalPaths.map(p => path.basename(p))
          };

          resolve({
            success: true,
            size: archiveSize,
            filesCount: filesCount,
            duration: duration,
            manifest: manifest
          });
        });

        archive.on('error', (err) => {
          console.error('[IPC] Ошибка архивирования:', err);
          reject(err);
        });

        archive.on('progress', (progress) => {
          processedSize = progress.fs.processedBytes;
          const percent = Math.round((processedSize / totalSize) * 100);
          
          // Отправляем прогресс в renderer
          event.sender.send('backup-progress', {
            percent: percent,
            processed: processedSize,
            total: totalSize
          });
        });

        // Подключаем поток
        archive.pipe(output);

        // 1. Добавляем базу данных как JSON файл
        archive.append(databaseJson, { name: '_database/arc_database.json' });
        console.log('[IPC] База данных добавлена в архив');

        // 2. Добавляем всю рабочую папку в архив
        archive.directory(workingDir, false);
        console.log('[IPC] Файлы добавлены в архив');

        // Завершаем архивирование
        archive.finalize();
      });
    } catch (error) {
      console.error('[IPC] Ошибка создания backup:', error);
      throw error;
    }
  });

  /**
   * Восстановить данные из резервной копии
   * TODO: Реализовать восстановление из ZIP
   */
  ipcMain.handle('restore-backup', async (_event, archivePath: string, targetDir: string) => {
    try {
      console.log('[IPC] Восстановление из backup...');
      console.log('[IPC] Архив:', archivePath);
      console.log('[IPC] Целевая директория:', targetDir);

      // TODO: Реализовать восстановление
      return true;
    } catch (error) {
      console.error('[IPC] Ошибка восстановления:', error);
      throw error;
    }
  });

  // === СИСТЕМНЫЕ ФУНКЦИИ ===

  /**
   * Показать системное уведомление
   */
  ipcMain.handle('show-notification', async (_event, title: string, body: string) => {
    try {
      const notification = new Notification({
        title,
        body
      });
      notification.show();
    } catch (error) {
      console.error('[IPC] Ошибка показа уведомления:', error);
      throw error;
    }
  });

  /**
   * Получить версию приложения
   */
  ipcMain.handle('get-app-version', async () => {
    return app.getVersion();
  });

  /**
   * Проверить наличие обновлений
   * TODO: Интеграция с electron-updater
   */
  ipcMain.handle('check-for-updates', async () => {
    console.log('[IPC] Проверка обновлений...');
    // TODO: Реализовать проверку обновлений
  });

  /**
   * Установить загруженное обновление
   * TODO: Интеграция с electron-updater
   */
  ipcMain.handle('install-update', async () => {
    console.log('[IPC] Установка обновления...');
    // TODO: Реализовать установку обновления
  });

  console.log('[IPC] Все IPC handlers зарегистрированы');
}

/**
 * Вспомогательная функция проверки существования файла
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Разбить файл на части
 * @param filePath - Путь к файлу для разбиения
 * @param parts - Количество частей (2, 4, 8)
 * @returns Массив путей к частям
 */
async function splitFile(filePath: string, parts: number): Promise<string[]> {
  console.log(`[IPC] Разбиение файла на ${parts} частей...`);
  
  // Читаем файл
  const fileBuffer = await fs.readFile(filePath);
  const fileSize = fileBuffer.length;
  const partSize = Math.ceil(fileSize / parts);
  
  const partPaths: string[] = [];
  const basePath = filePath.replace(/\.(arc|zip)$/, '');
  
  for (let i = 0; i < parts; i++) {
    const start = i * partSize;
    const end = Math.min(start + partSize, fileSize);
    const partBuffer = fileBuffer.slice(start, end);
    
    const partNum = (i + 1).toString().padStart(2, '0');
    const partPath = `${basePath}.arc.part${partNum}`;
    
    await fs.writeFile(partPath, partBuffer);
    partPaths.push(partPath);
    
    console.log(`[IPC] Создана часть ${partNum}: ${Math.round(partBuffer.length / 1024 / 1024)} MB`);
  }
  
  // Удаляем оригинальный файл
  await fs.unlink(filePath);
  console.log('[IPC] Оригинальный файл удалён');
  
  return partPaths;
}

