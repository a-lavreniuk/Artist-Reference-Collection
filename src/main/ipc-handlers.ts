/**
 * Обработчики IPC событий для коммуникации между main и renderer процессами
 * Здесь регистрируются все handlers для работы с файловой системой и системными функциями
 */

import { ipcMain, dialog, Notification, app, shell, clipboard } from 'electron';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import archiver from 'archiver';
import extract from 'extract-zip';
import { DownloadManager } from './download-manager';

// Настраиваем путь к ffmpeg бинарнику
// В ASAR архиве ffmpeg не может быть запущен, используем распакованную версию
let ffmpegPath = ffmpegInstaller.path;

if (app.isPackaged) {
  // В продакшене заменяем путь внутри ASAR на путь к распакованной версии
  // app.asar -> app.asar.unpacked
  ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
  console.log('[IPC] Используется ffmpeg из распакованного ASAR:', ffmpegPath);
}

ffmpeg.setFfmpegPath(ffmpegPath);

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
      
      // Устанавливаем рабочую директорию для менеджера загрузок
      DownloadManager.getInstance().setWorkingDirectory(selectedPath);
      
      return selectedPath;
    } catch (error) {
      console.error('[IPC] Ошибка выбора папки:', error);
      throw error;
    }
  });

  /**
   * Установить рабочую директорию (вызывается при старте)
   */
  ipcMain.handle('set-working-directory', async (_event, dirPath: string) => {
    try {
      if (dirPath && typeof dirPath === 'string') {
        DownloadManager.getInstance().setWorkingDirectory(dirPath);
        console.log('[IPC] Рабочая директория установлена:', dirPath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[IPC] Ошибка установки рабочей директории:', error);
      return false;
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
          { name: 'ZIP архивы', extensions: ['zip'] },
          { name: 'ARC архивы', extensions: ['arc'] }
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
   * Открыть диалог выбора архива для восстановления
   */
  ipcMain.handle('select-archive-path', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Выберите архив для восстановления',
        properties: ['openFile'],
        filters: [
          { name: 'ZIP архивы', extensions: ['zip'] },
          { name: 'Части архива', extensions: ['part01', 'part02', 'part03', 'part04', 'part05', 'part06', 'part07', 'part08'] },
          { name: 'Все файлы', extensions: ['*'] }
        ]
      });

      if (result.canceled || result.filePaths.length === 0) {
        console.log('[IPC] Выбор архива отменён');
        return undefined;
      }

      console.log('[IPC] Выбран архив:', result.filePaths[0]);
      return result.filePaths[0];
    } catch (error) {
      console.error('[IPC] Ошибка выбора архива:', error);
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
   * Сканировать папку импорта (_cache/imports)
   */
  ipcMain.handle('scan-import-directory', async () => {
    try {
      // Получаем путь через DownloadManager, так как он знает где лежит temp
      // Используем приватное свойство через any, так как нет публичного геттера
      // В будущем стоит добавить публичный метод getTempDir()
      const downloadManager = DownloadManager.getInstance();
      const tempDir = (downloadManager as any).tempDir; 
      
      console.log('[IPC] Сканирование папки импорта:', tempDir);
      
      if (!tempDir) {
        console.log('[IPC] Папка импорта не определена');
        return [];
      }
      
      try {
        await fs.access(tempDir);
      } catch {
        console.log('[IPC] Папка импорта не существует');
        return [];
      }

      const supportedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.webm'];
      const files: string[] = [];
      
      const entries = await fs.readdir(tempDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (supportedExtensions.includes(ext)) {
            files.push(path.join(tempDir, entry.name));
          }
        }
      }
      
      console.log(`[IPC] В импорте найдено файлов: ${files.length}`);
      return files;
    } catch (error) {
      console.error('[IPC] Ошибка сканирования папки импорта:', error);
      return [];
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
   * Переместить файл из временной папки в рабочую папку с организацией по дате
   */
  ipcMain.handle('move-file-to-working-dir', async (_event, sourcePath: string, workingDir: string) => {
    try {
      console.log('[IPC] Перемещение файла:', sourcePath);

      // Создаём структуру папок год/месяц/день
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');

      const targetDir = path.join(workingDir, year, month, day);
      await fs.mkdir(targetDir, { recursive: true });

      // Перемещаем файл
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

      // Перемещаем файл (rename = move в пределах одного диска)
      await fs.rename(sourcePath, finalPath);
      console.log('[IPC] Файл перемещен в:', finalPath);

      return finalPath;
    } catch (error) {
      console.error('[IPC] Ошибка перемещения файла:', error);
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
        console.log('[IPC] Путь к ffmpeg:', ffmpegInstaller.path);
        console.log('[IPC] Исходный файл:', filePath);
        console.log('[IPC] Папка превью:', thumbsDir);
        console.log('[IPC] Имя превью:', thumbName);
        
        // Проверяем существование исходного видео файла
        const videoExists = await fileExists(filePath);
        if (!videoExists) {
          console.error('[IPC] Исходный видео файл не найден!');
          return thumbPath; // Возвращаем путь, UI покажет placeholder
        }
        
        await new Promise<void>((resolve, reject) => {
          ffmpeg(filePath)
            .on('start', (commandLine) => {
              console.log('[IPC] ffmpeg команда:', commandLine);
            })
            .screenshots({
              count: 1,
              folder: thumbsDir,
              filename: thumbName,
              size: '512x?', // 512px по ширине, высота автоматически
              timemarks: ['00:00:00.100'] // Кадр на 0.1 секунде (для коротких видео)
            })
            .on('end', () => {
              console.log('[IPC] ✅ Превью видео создано успешно');
              resolve();
            })
            .on('error', (err, stdout, stderr) => {
              console.error('[IPC] ❌ Ошибка ffmpeg:', err.message);
              console.error('[IPC] stderr:', stderr);
              // Если не удалось создать превью, не прерываем процесс
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

  // === СИСТЕМНЫЕ ОПЕРАЦИИ С ФАЙЛАМИ ===

  /**
   * Открыть папку с файлом в проводнике Windows
   */
  ipcMain.handle('open-file-location', async (_event, filePath: string) => {
    try {
      console.log('[IPC] Открытие папки с файлом:', filePath);
      
      // Проверяем существование файла
      const exists = await fileExists(filePath);
      if (!exists) {
        console.error('[IPC] Файл не найден:', filePath);
        throw new Error('Файл не найден');
      }
      
      // shell.showItemInFolder открывает проводник и выделяет файл
      shell.showItemInFolder(filePath);
      console.log('[IPC] Папка открыта успешно');
      return true;
    } catch (error) {
      console.error('[IPC] Ошибка открытия папки:', error);
      throw error;
    }
  });

  /**
   * Экспортировать файл в выбранную папку
   */
  ipcMain.handle('export-file', async (_event, sourcePath: string, defaultFileName: string) => {
    try {
      console.log('[IPC] Экспорт файла:', sourcePath);
      
      // Проверяем существование исходного файла
      const exists = await fileExists(sourcePath);
      if (!exists) {
        console.error('[IPC] Исходный файл не найден:', sourcePath);
        throw new Error('Исходный файл не найден');
      }
      
      // Диалог выбора места сохранения
      const result = await dialog.showSaveDialog({
        title: 'Экспорт файла',
        defaultPath: defaultFileName,
        filters: [
          { name: 'Все файлы', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        console.log('[IPC] Экспорт отменён');
        return null;
      }

      // Копируем файл
      await fs.copyFile(sourcePath, result.filePath);
      console.log('[IPC] Файл экспортирован:', result.filePath);
      
      return result.filePath;
    } catch (error) {
      console.error('[IPC] Ошибка экспорта файла:', error);
      throw error;
    }
  });

  /**
   * Скопировать текст в буфер обмена
   */
  ipcMain.handle('copy-to-clipboard', async (_event, text: string) => {
    try {
      clipboard.writeText(text);
      console.log('[IPC] Текст скопирован в буфер:', text.substring(0, 50) + '...');
      return true;
    } catch (error) {
      console.error('[IPC] Ошибка копирования в буфер:', error);
      throw error;
    }
  });

  /**
   * Удалить файл с диска
   * @param filePath - Путь к файлу для удаления
   * @returns true если успешно
   */
  ipcMain.handle('delete-file', async (_event, filePath: string) => {
    try {
      // Проверяем существование файла
      const exists = await fileExists(filePath);
      if (!exists) {
        console.log('[IPC] Файл не найден (пропускаем):', filePath);
        return true; // Возвращаем true так как файла уже нет
      }

      await fs.unlink(filePath);
      console.log('[IPC] Файл удалён:', filePath);
      return true;
    } catch (error) {
      console.error('[IPC] Ошибка удаления файла:', error);
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

      return new Promise(async (resolve, reject) => {
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
        // Вручную добавляем все файлы и папки рекурсивно
        console.log('[IPC] Добавление файлов в архив...');
        
        async function addDirectoryToArchive(dirPath: string, archivePath: string = '') {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          console.log(`[IPC] Сканирование папки: ${dirPath} (найдено ${entries.length} элементов)`);
          
          for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const archiveEntryPath = archivePath ? path.join(archivePath, entry.name) : entry.name;
            
            if (entry.isDirectory()) {
              // Рекурсивно добавляем содержимое папки
              console.log(`[IPC] Обход папки: ${entry.name}`);
              await addDirectoryToArchive(fullPath, archiveEntryPath);
            } else if (entry.isFile()) {
              // Добавляем файл
              console.log(`[IPC] Добавление файла: ${archiveEntryPath}`);
              archive.file(fullPath, { name: archiveEntryPath });
            }
          }
        }
        
        await addDirectoryToArchive(workingDir);
        console.log('[IPC] Все файлы добавлены в очередь архива');

        // Завершаем архивирование
        archive.finalize();
        console.log('[IPC] Finalize вызван, ждём завершения...');
      });
    } catch (error) {
      console.error('[IPC] Ошибка создания backup:', error);
      throw error;
    }
  });

  /**
   * Восстановить данные из резервной копии
   * Распаковывает архив и возвращает JSON базы данных
   */
  ipcMain.handle('restore-backup', async (event, archivePath: string, targetDir: string) => {
    try {
      console.log('[IPC] Восстановление из backup...');
      console.log('[IPC] Архив:', archivePath);
      console.log('[IPC] Целевая директория:', targetDir);

      // 1. Проверяем тип файла (одиночный или части)
      let zipPath = archivePath;
      const isPart = archivePath.includes('.arc.part');
      
      if (isPart) {
        // Объединяем части в один файл
        console.log('[IPC] Обнаружены части архива, объединяем...');
        zipPath = await mergeFileParts(archivePath);
      }

      // 2. Создаём временную папку для распаковки
      const tempDir = path.join(app.getPath('temp'), `arc_restore_${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });
      console.log('[IPC] Временная папка:', tempDir);

      // 3. Распаковываем архив
      console.log('[IPC] Распаковка архива...');
      await extract(zipPath, { dir: tempDir });
      console.log('[IPC] Архив распакован');

      // 4. Читаем базу данных из архива
      const dbPath = path.join(tempDir, '_database', 'arc_database.json');
      let databaseJson: string | null = null;
      
      try {
        databaseJson = await fs.readFile(dbPath, 'utf-8');
        console.log('[IPC] База данных прочитана из архива');
      } catch {
        console.log('[IPC] База данных не найдена в архиве');
      }

      // 5. Создаём целевую директорию если не существует
      await fs.mkdir(targetDir, { recursive: true });

      // 6. Копируем файлы из временной папки в целевую
      console.log('[IPC] Копирование файлов...');
      
      async function copyDirectory(src: string, dest: string): Promise<void> {
        const entries = await fs.readdir(src, { withFileTypes: true });
        
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          
          // Пропускаем папку _database (она не нужна в рабочей папке)
          if (entry.name === '_database') {
            continue;
          }
          
          if (entry.isDirectory()) {
            await fs.mkdir(destPath, { recursive: true });
            await copyDirectory(srcPath, destPath);
          } else if (entry.isFile()) {
            await fs.copyFile(srcPath, destPath);
          }
        }
      }
      
      await copyDirectory(tempDir, targetDir);
      console.log('[IPC] Файлы скопированы');

      // 7. Очищаем временную папку
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log('[IPC] Временная папка удалена');
      
      // 8. Если был создан merged файл, удаляем его
      if (isPart && zipPath.includes('_merged.zip')) {
        await fs.unlink(zipPath);
        console.log('[IPC] Временный объединенный файл удален');
      }

      console.log('[IPC] Восстановление завершено');
      
      // Возвращаем JSON базы данных для импорта в renderer
      return {
        success: true,
        databaseJson: databaseJson
      };
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
   * Открыть папку с логами приложения
   */
  ipcMain.handle('open-logs-folder', async () => {
    try {
      const userDataPath = app.getPath('userData');
      await shell.openPath(userDataPath);
      console.log('[IPC] Открыта папка с логами:', userDataPath);
    } catch (error) {
      console.error('[IPC] Ошибка открытия папки с логами:', error);
      throw error;
    }
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

  /**
   * Переместить рабочую папку в новое место
   * Копирует все файлы и папки из старой директории в новую
   */
  ipcMain.handle('move-working-directory', async (event, oldDir: string, newDir: string) => {
    try {
      console.log('[IPC] Перенос рабочей папки...');
      console.log('[IPC] Из:', oldDir);
      console.log('[IPC] В:', newDir);

      // Проверяем что старая папка существует
      try {
        await fs.access(oldDir);
      } catch {
        throw new Error('Старая рабочая папка недоступна');
      }

      // Создаём новую папку
      await fs.mkdir(newDir, { recursive: true });

      // Подсчитываем количество файлов для прогресса
      let totalFiles = 0;
      let copiedFiles = 0;

      async function countFiles(dir: string): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await countFiles(fullPath);
          } else {
            totalFiles++;
          }
        }
      }

      await countFiles(oldDir);
      console.log(`[IPC] Найдено файлов для копирования: ${totalFiles}`);

      // Рекурсивное копирование с прогрессом
      async function copyDirectory(src: string, dest: string): Promise<void> {
        const entries = await fs.readdir(src, { withFileTypes: true });
        
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          
          if (entry.isDirectory()) {
            await fs.mkdir(destPath, { recursive: true });
            await copyDirectory(srcPath, destPath);
          } else if (entry.isFile()) {
            await fs.copyFile(srcPath, destPath);
            copiedFiles++;
            
            const percent = Math.round((copiedFiles / totalFiles) * 100);
            event.sender.send('move-directory-progress', {
              percent,
              copied: copiedFiles,
              total: totalFiles
            });
            
            if (copiedFiles % 10 === 0) {
              console.log(`[IPC] Скопировано: ${copiedFiles}/${totalFiles} (${percent}%)`);
            }
          }
        }
      }

      await copyDirectory(oldDir, newDir);
      
      console.log('[IPC] Все файлы скопированы');
      
      return {
        success: true,
        copiedFiles: copiedFiles
      };
    } catch (error) {
      console.error('[IPC] Ошибка переноса папки:', error);
      throw error;
    }
  });

  /**
   * Экспортировать мудборд в отдельную папку
   * Копирует все файлы из мудборда в выбранную папку
   */
  ipcMain.handle('export-moodboard', async (event, filePaths: string[], targetDir: string) => {
    try {
      console.log('[IPC] Экспорт мудборда...');
      console.log('[IPC] Файлов для экспорта:', filePaths.length);
      console.log('[IPC] Целевая папка:', targetDir);

      // Создаём целевую папку
      await fs.mkdir(targetDir, { recursive: true });

      let copiedCount = 0;
      const failedFiles: string[] = [];

      for (let i = 0; i < filePaths.length; i++) {
        const sourcePath = filePaths[i];
        
        try {
          // Проверяем существование файла
          const exists = await fileExists(sourcePath);
          if (!exists) {
            console.warn(`[IPC] Файл не найден: ${sourcePath}`);
            failedFiles.push(sourcePath);
            continue;
          }

          // Копируем файл с оригинальным именем
          const fileName = path.basename(sourcePath);
          const targetPath = path.join(targetDir, fileName);
          
          await fs.copyFile(sourcePath, targetPath);
          copiedCount++;
          
          // Отправляем прогресс
          const percent = Math.round(((i + 1) / filePaths.length) * 100);
          event.sender.send('export-progress', {
            percent,
            copied: copiedCount,
            total: filePaths.length
          });
          
          console.log(`[IPC] Экспортирован ${i + 1}/${filePaths.length}: ${fileName}`);
        } catch (error) {
          console.error(`[IPC] Ошибка копирования файла ${sourcePath}:`, error);
          failedFiles.push(sourcePath);
        }
      }

      console.log(`[IPC] Экспорт завершён. Скопировано: ${copiedCount}, ошибок: ${failedFiles.length}`);
      
      return {
        success: true,
        copiedCount,
        failedCount: failedFiles.length,
        failedFiles
      };
    } catch (error) {
      console.error('[IPC] Ошибка экспорта мудборда:', error);
      throw error;
    }
  });

  /**
   * Получить информацию о размерах файлов в рабочей папке
   * Подсчитывает размеры изображений, видео и превью
   */
  ipcMain.handle('get-directory-size', async (_event, workingDir: string) => {
    try {
      console.log('[IPC] Подсчёт размеров для:', workingDir);
      
      let totalSize = 0;
      let imagesSize = 0;
      let videosSize = 0;
      let cacheSize = 0;
      let imageCount = 0;
      let videoCount = 0;
      
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      const videoExtensions = ['.mp4', '.webm', '.mov', '.avi'];
      
      async function calculateSize(dir: string, isCache: boolean = false): Promise<void> {
        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          console.log(`[IPC] Сканирование: ${dir} (найдено ${entries.length} элементов)`);
          
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory()) {
              // Рекурсивно обходим папки
              const isCacheDir = entry.name === '_cache' || isCache;
              console.log(`[IPC] Обход папки: ${entry.name} (isCache: ${isCacheDir})`);
              await calculateSize(fullPath, isCacheDir);
            } else if (entry.isFile()) {
              try {
                const stats = await fs.stat(fullPath);
                const ext = path.extname(entry.name).toLowerCase();
                
                totalSize += stats.size;
                
                if (isCache) {
                  cacheSize += stats.size;
                  console.log(`[IPC] Файл кэша: ${entry.name} (${Math.round(stats.size / 1024)} KB)`);
                } else if (imageExtensions.includes(ext)) {
                  imagesSize += stats.size;
                  imageCount++;
                  console.log(`[IPC] Изображение: ${entry.name} (${Math.round(stats.size / 1024)} KB)`);
                } else if (videoExtensions.includes(ext)) {
                  videosSize += stats.size;
                  videoCount++;
                  console.log(`[IPC] Видео: ${entry.name} (${Math.round(stats.size / 1024)} KB)`);
                }
              } catch (error) {
                // Пропускаем файлы с ошибками доступа
                console.warn(`[IPC] Не удалось прочитать файл: ${fullPath}`, error);
              }
            }
          }
        } catch (error) {
          console.error(`[IPC] ОШИБКА чтения директории: ${dir}`, error);
        }
      }
      
      console.log('[IPC] Начало сканирования:', workingDir);
      await calculateSize(workingDir);
      
      console.log('[IPC] Подсчёт завершён:', {
        total: Math.round(totalSize / 1024 / 1024) + ' MB',
        images: Math.round(imagesSize / 1024 / 1024) + ' MB',
        videos: Math.round(videosSize / 1024 / 1024) + ' MB',
        cache: Math.round(cacheSize / 1024 / 1024) + ' MB'
      });
      
      return {
        totalSize,
        imagesSize,
        videosSize,
        cacheSize,
        imageCount,
        videoCount
      };
    } catch (error) {
      console.error('[IPC] Ошибка подсчёта размеров:', error);
      throw error;
    }
  });

  // === ИСТОРИЯ ДЕЙСТВИЙ ===

  /**
   * Получить путь к файлу истории
   * Файл history.json хранится в рабочей папке рядом с данными
   */
  function getHistoryFilePath(workingDir?: string): string {
    if (workingDir) {
      // Храним в рабочей папке рядом с данными
      return path.join(workingDir, 'history.json');
    }
    // Fallback на userData если рабочая папка не указана
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'history.json');
  }

  /**
   * Получить историю действий из JSON файла
   */
  ipcMain.handle('get-history', async (_event, workingDir?: string) => {
    try {
      const historyPath = getHistoryFilePath(workingDir);
      console.log('[IPC] Чтение истории из:', historyPath);

      // Проверяем существование файла
      const exists = await fileExists(historyPath);
      if (!exists) {
        console.log('[IPC] Файл истории не найден, возвращаем пустой массив');
        return [];
      }

      // Читаем и парсим JSON
      const content = await fs.readFile(historyPath, 'utf-8');
      const history = JSON.parse(content);

      console.log(`[IPC] Прочитано ${history.length} записей истории`);
      return history;
    } catch (error) {
      console.error('[IPC] Ошибка чтения истории:', error);
      // Возвращаем пустой массив в случае ошибки
      return [];
    }
  });

  /**
   * Добавить запись в историю действий
   * Сохраняет максимум 1000 последних записей
   */
  ipcMain.handle('add-history-entry', async (_event, workingDir: string | undefined, entry: {
    action: string;
    description: string;
    metadata?: any;
  }) => {
    try {
      const historyPath = getHistoryFilePath(workingDir);
      console.log('[IPC] Добавление записи в историю:', entry.description);
      console.log('[IPC] Путь к файлу истории:', historyPath);
      console.log('[IPC] Рабочая директория:', workingDir);

      // Убеждаемся что директория существует
      const historyDir = path.dirname(historyPath);
      await fs.mkdir(historyDir, { recursive: true });
      console.log('[IPC] Директория истории проверена:', historyDir);

      // Читаем текущую историю
      let history: any[] = [];
      const exists = await fileExists(historyPath);
      
      if (exists) {
        try {
          const content = await fs.readFile(historyPath, 'utf-8');
          history = JSON.parse(content);
          console.log('[IPC] Прочитано записей из файла:', history.length);
        } catch (parseError) {
          console.warn('[IPC] Не удалось прочитать историю, создаём новую:', parseError);
          history = [];
        }
      } else {
        console.log('[IPC] Файл истории не существует, создаём новый');
      }

      // Добавляем новую запись в начало
      const newEntry = {
        id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        action: entry.action,
        description: entry.description,
        metadata: entry.metadata || {}
      };

      history.unshift(newEntry);
      console.log('[IPC] Новая запись добавлена:', newEntry);

      // Ограничиваем лимитом в 1000 записей
      if (history.length > 1000) {
        history = history.slice(0, 1000);
        console.log('[IPC] История обрезана до 1000 записей');
      }

      // Сохраняем обратно в файл
      await fs.writeFile(historyPath, JSON.stringify(history, null, 2), 'utf-8');
      console.log('[IPC] История успешно сохранена, всего записей:', history.length);
    } catch (error) {
      console.error('[IPC] ОШИБКА добавления записи в историю:', error);
      throw error;
    }
  });

  /**
   * Очистить всю историю действий
   */
  ipcMain.handle('clear-history', async (_event, workingDir?: string) => {
    try {
      const historyPath = getHistoryFilePath(workingDir);
      console.log('[IPC] Очистка истории');
      console.log('[IPC] Путь к файлу истории:', historyPath);

      // Проверяем существование файла
      const exists = await fileExists(historyPath);
      if (exists) {
        // Удаляем файл истории
        await fs.unlink(historyPath);
        console.log('[IPC] Файл истории удалён');
      } else {
        console.log('[IPC] Файл истории не существует, очистка не требуется');
      }
    } catch (error) {
      console.error('[IPC] Ошибка очистки истории:', error);
      throw error;
    }
  });

  // === НАСТРОЙКИ ПРИЛОЖЕНИЯ ===

  /**
   * Сохранить настройку приложения в userData
   */
  ipcMain.handle('save-setting', async (_event, key: string, value: any) => {
    try {
      const settingsPath = path.join(app.getPath('userData'), 'settings.json');
      
      // Читаем существующие настройки
      let settings: Record<string, any> = {};
      try {
        const data = await fs.readFile(settingsPath, 'utf-8');
        settings = JSON.parse(data);
      } catch (error) {
        // Файл не существует, создадим новый
      }
      
      // Сохраняем новое значение
      settings[key] = value;
      
      // Записываем обратно
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
      console.log('[IPC] Настройка сохранена:', key);
    } catch (error) {
      console.error('[IPC] Ошибка сохранения настройки:', error);
      throw error;
    }
  });

  /**
   * Получить настройку приложения из userData
   */
  ipcMain.handle('get-setting', async (_event, key: string) => {
    try {
      const settingsPath = path.join(app.getPath('userData'), 'settings.json');
      
      // Читаем настройки
      try {
        const data = await fs.readFile(settingsPath, 'utf-8');
        const settings = JSON.parse(data);
        return settings[key] !== undefined ? settings[key] : null;
      } catch (error) {
        // Файл не существует
        return null;
      }
    } catch (error) {
      console.error('[IPC] Ошибка чтения настройки:', error);
      return null;
    }
  });

  /**
   * Удалить настройку приложения
   */
  ipcMain.handle('remove-setting', async (_event, key: string) => {
    try {
      const settingsPath = path.join(app.getPath('userData'), 'settings.json');
      
      // Читаем существующие настройки
      try {
        const data = await fs.readFile(settingsPath, 'utf-8');
        const settings = JSON.parse(data);
        
        // Удаляем ключ
        delete settings[key];
        
        // Записываем обратно
        await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
        console.log('[IPC] Настройка удалена:', key);
      } catch (error) {
        // Файл не существует, ничего делать не нужно
      }
    } catch (error) {
      console.error('[IPC] Ошибка удаления настройки:', error);
      throw error;
    }
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

/**
 * Объединить части архива в один файл
 * @param firstPartPath - Путь к первой части (.part01)
 * @returns Путь к объединенному файлу
 */
async function mergeFileParts(firstPartPath: string): Promise<string> {
  console.log('[IPC] Объединение частей архива...');
  
  // Определяем базовое имя и ищем все части
  const basePath = firstPartPath.replace(/\.arc\.part\d+$/, '');
  const dir = path.dirname(firstPartPath);
  const files = await fs.readdir(dir);
  
  // Находим все части
  const partFiles = files
    .filter(f => f.startsWith(path.basename(basePath)) && f.includes('.arc.part'))
    .sort();
  
  console.log(`[IPC] Найдено частей: ${partFiles.length}`);
  
  // Объединяем в один файл
  const outputPath = `${basePath}_merged.zip`;
  const outputStream = fsSync.createWriteStream(outputPath);
  
  for (const partFile of partFiles) {
    const partPath = path.join(dir, partFile);
    const partBuffer = await fs.readFile(partPath);
    outputStream.write(partBuffer);
    console.log(`[IPC] Добавлена часть: ${partFile}`);
  }
  
  outputStream.end();
  
  // Ждем завершения записи
  await new Promise<void>((resolve) => outputStream.on('finish', () => resolve()));
  
  console.log('[IPC] Файл объединен:', outputPath);
  return outputPath;
}

