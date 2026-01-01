/**
 * Константы и утилиты для работы с медиаформатами
 */

import type { ImageFormat, VideoFormat } from '../types';

// Форматы изображений по категориям
export const IMAGE_FORMATS = {
  // Базовые форматы (полная поддержка)
  COMMON: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] as const,
  
  // TIFF форматы
  TIFF: ['tiff', 'tif'] as const,
  
  // HEIC/HEIF форматы
  HEIC: ['heic', 'heif'] as const,
  
  // JPEG XL
  JXL: ['jxl'] as const,
  
  // RAW форматы
  RAW: ['cr2', 'nef', 'dng', 'arw', 'orf', 'rw2'] as const,
  
  // PDF
  PDF: ['pdf'] as const,
} as const;

// Форматы видео по категориям
export const VIDEO_FORMATS = {
  // HTML5 совместимые (воспроизводятся в браузере)
  HTML5: ['mp4', 'webm', 'ogv', 'm4v'] as const,
  
  // Частично совместимые (зависит от кодека)
  PARTIAL: ['mov', 'avi', 'mkv', 'mpeg', 'mpg', 'm2v', '3gp', 'ts', 'mts'] as const,
  
  // Несовместимые с HTML5 (только превью через ffmpeg)
  LEGACY: ['flv', 'wmv', 'vob', 'rmvb', 'swf'] as const,
} as const;

// Все поддерживаемые форматы изображений
export const ALL_IMAGE_FORMATS: readonly ImageFormat[] = [
  ...IMAGE_FORMATS.COMMON,
  ...IMAGE_FORMATS.TIFF,
  ...IMAGE_FORMATS.HEIC,
  ...IMAGE_FORMATS.JXL,
  ...IMAGE_FORMATS.RAW,
  ...IMAGE_FORMATS.PDF,
];

// Все поддерживаемые форматы видео
export const ALL_VIDEO_FORMATS: readonly VideoFormat[] = [
  ...VIDEO_FORMATS.HTML5,
  ...VIDEO_FORMATS.PARTIAL,
  ...VIDEO_FORMATS.LEGACY,
];

// Все поддерживаемые форматы
export const ALL_MEDIA_FORMATS = [
  ...ALL_IMAGE_FORMATS,
  ...ALL_VIDEO_FORMATS,
] as const;

// HTML5 совместимые видео форматы (можно воспроизвести в браузере)
export const HTML5_COMPATIBLE_VIDEO_FORMATS = VIDEO_FORMATS.HTML5;

// Проверка является ли формат изображением
export function isImageFormat(format: string): format is ImageFormat {
  return ALL_IMAGE_FORMATS.includes(format as ImageFormat);
}

// Проверка является ли формат видео
export function isVideoFormat(format: string): format is VideoFormat {
  return ALL_VIDEO_FORMATS.includes(format as VideoFormat);
}

// Проверка может ли видео воспроизводиться в браузере
export function canPlayInBrowser(format: VideoFormat): boolean {
  return HTML5_COMPATIBLE_VIDEO_FORMATS.includes(format as any);
}

// Проверка является ли формат RAW
export function isRawFormat(format: string): boolean {
  return IMAGE_FORMATS.RAW.includes(format as any);
}

// Проверка является ли формат PDF
export function isPdfFormat(format: string): boolean {
  return format === 'pdf';
}

// Получить список расширений для file input accept
export function getAcceptString(): string {
  return ALL_MEDIA_FORMATS.map(ext => `.${ext}`).join(',');
}

// MIME типы для всех форматов
export const MIME_TYPES: Record<string, string> = {
  // Изображения
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'webp': 'image/webp',
  'gif': 'image/gif',
  'bmp': 'image/bmp',
  'tiff': 'image/tiff',
  'tif': 'image/tiff',
  'heic': 'image/heic',
  'heif': 'image/heif',
  'jxl': 'image/jxl',
  'pdf': 'application/pdf',
  
  // RAW форматы
  'cr2': 'image/x-canon-cr2',
  'nef': 'image/x-nikon-nef',
  'dng': 'image/x-adobe-dng',
  'arw': 'image/x-sony-arw',
  'orf': 'image/x-olympus-orf',
  'rw2': 'image/x-panasonic-rw2',
  
  // Видео
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'mov': 'video/quicktime',
  'avi': 'video/x-msvideo',
  'mkv': 'video/x-matroska',
  'flv': 'video/x-flv',
  'wmv': 'video/x-ms-wmv',
  'mpeg': 'video/mpeg',
  'mpg': 'video/mpeg',
  'm2v': 'video/mpeg',
  '3gp': 'video/3gpp',
  'ts': 'video/mp2t',
  'mts': 'video/mp2t',
  'm4v': 'video/x-m4v',
  'ogv': 'video/ogg',
  'vob': 'video/dvd',
  'rmvb': 'application/vnd.rn-realmedia-vbr',
  'swf': 'application/x-shockwave-flash',
};

// Получить MIME тип по расширению
export function getMimeType(extension: string): string {
  const ext = extension.toLowerCase().replace('.', '');
  return MIME_TYPES[ext] || 'application/octet-stream';
}

