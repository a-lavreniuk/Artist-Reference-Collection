/**
 * Утилита для определения типа медиафайла
 * Использует magic bytes для надежного определения типа
 */

import * as path from 'path';
import * as mimeTypes from 'mime-types';
import * as fs from 'fs/promises';

// Поддерживаемые форматы изображений
const SUPPORTED_IMAGE_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp',
  'tiff', 'tif', 'heic', 'heif', 'jxl',
  'cr2', 'nef', 'dng', 'arw', 'orf', 'rw2', // RAW форматы
  'pdf'
];

// Поддерживаемые форматы видео
const SUPPORTED_VIDEO_EXTENSIONS = [
  'mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv',
  'mpeg', 'mpg', 'm2v', '3gp', 'ts', 'mts', 'm4v',
  'ogv', 'vob', 'rmvb', 'swf'
];

export interface FileTypeInfo {
  ext: string;           // Расширение файла
  mime: string;          // MIME тип
  isImage: boolean;      // Является ли изображением
  isVideo: boolean;      // Является ли видео
  isSupported: boolean;  // Поддерживается ли формат
  isRaw: boolean;        // Является ли RAW форматом
  isPdf: boolean;        // Является ли PDF
}

/**
 * Определить тип файла по расширению и простой проверке magic bytes
 * @param filePath - Путь к файлу
 * @returns Информация о типе файла
 */
export async function detectFileType(filePath: string): Promise<FileTypeInfo> {
  // Получаем расширение из имени файла
  const extFromPath = path.extname(filePath).toLowerCase().replace('.', '');
  
  // Определяем MIME тип через библиотеку mime-types
  let mime = mimeTypes.lookup(filePath) || 'application/octet-stream';

  // Для RAW форматов устанавливаем MIME вручную
  const rawFormats = ['cr2', 'nef', 'dng', 'arw', 'orf', 'rw2'];
  if (rawFormats.includes(extFromPath)) {
    mime = `image/x-${extFromPath}`;
  }

  // Для PDF
  if (extFromPath === 'pdf') {
    mime = 'application/pdf';
  }

  // Определяем категории
  const isImage = SUPPORTED_IMAGE_EXTENSIONS.includes(extFromPath) || mime.startsWith('image/');
  const isVideo = SUPPORTED_VIDEO_EXTENSIONS.includes(extFromPath) || mime.startsWith('video/');
  const isSupported = isImage || isVideo;
  const isRaw = rawFormats.includes(extFromPath);
  const isPdf = extFromPath === 'pdf';

  return {
    ext: extFromPath,
    mime,
    isImage,
    isVideo,
    isSupported,
    isRaw,
    isPdf
  };
}

/**
 * Проверить является ли файл поддерживаемым медиафайлом
 * @param filePath - Путь к файлу
 * @returns true если файл поддерживается
 */
export async function isSupportedMediaFile(filePath: string): Promise<boolean> {
  const info = await detectFileType(filePath);
  return info.isSupported;
}

/**
 * Получить список всех поддерживаемых расширений
 * @returns Массив расширений без точки
 */
export function getSupportedExtensions(): string[] {
  return [...SUPPORTED_IMAGE_EXTENSIONS, ...SUPPORTED_VIDEO_EXTENSIONS];
}

/**
 * Получить список всех поддерживаемых расширений с точкой
 * @returns Массив расширений с точкой
 */
export function getSupportedExtensionsWithDot(): string[] {
  return getSupportedExtensions().map(ext => `.${ext}`);
}

