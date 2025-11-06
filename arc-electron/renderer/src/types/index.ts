/**
 * Базовые TypeScript типы для приложения ARC
 * Artist Reference Collection
 */

// Тип медиафайла
export type MediaType = 'image' | 'video';

// Формат изображения
export type ImageFormat = 'jpg' | 'jpeg' | 'png' | 'webp';

// Формат видео
export type VideoFormat = 'mp4' | 'webm';

// Карточка - основная единица контента
export interface Card {
  id: string;                          // Уникальный ID карточки
  fileName: string;                    // Имя файла
  filePath: string;                    // Путь к файлу
  type: MediaType;                     // Тип: изображение или видео
  format: ImageFormat | VideoFormat;   // Формат файла
  dateAdded: Date;                     // Дата добавления
  dateModified?: Date;                 // Дата последнего изменения
  fileSize: number;                    // Размер файла в байтах
  width?: number;                      // Ширина (для изображений)
  height?: number;                     // Высота (для изображений)
  duration?: number;                   // Длительность (для видео)
  thumbnailUrl?: string;               // URL превью из IndexedDB
  tags: string[];                      // Массив ID меток
  collections: string[];               // Массив ID коллекций
  inMoodboard: boolean;                // Находится ли в мудборде
}

// Метка для категоризации карточек
export interface Tag {
  id: string;                          // Уникальный ID метки
  name: string;                        // Название метки
  categoryId: string;                  // ID категории, к которой принадлежит
  color?: string;                      // Цвет метки (опционально)
  dateCreated: Date;                   // Дата создания
  cardCount: number;                   // Количество карточек с этой меткой
}

// Категория для группировки меток
export interface Category {
  id: string;                          // Уникальный ID категории
  name: string;                        // Название категории
  color?: string;                      // Цвет категории
  dateCreated: Date;                   // Дата создания
  tagIds: string[];                    // Массив ID меток в категории
}

// Коллекция - набор карточек
export interface Collection {
  id: string;                          // Уникальный ID коллекции
  name: string;                        // Название коллекции
  description?: string;                // Описание (опционально)
  dateCreated: Date;                   // Дата создания
  dateModified: Date;                  // Дата последнего изменения
  cardIds: string[];                   // Массив ID карточек в коллекции
  thumbnails: string[];                // Массив URL превью (первые 4 карточки)
}

// Мудборд - временное рабочее пространство
export interface Moodboard {
  id: string;                          // ID мудборда (обычно один - 'default')
  cardIds: string[];                   // Массив ID карточек в мудборде
  dateModified: Date;                  // Дата последнего изменения
}

// Настройки приложения
export interface AppSettings {
  id: string;                          // ID настроек (один - 'settings')
  workingDirectory?: string;           // Путь к рабочей папке
  theme: 'light' | 'dark';             // Тема (пока только светлая)
  dateInstalled: Date;                 // Дата установки приложения
  version: string;                     // Версия приложения
}

// История поиска
export interface SearchHistory {
  id: string;                          // Уникальный ID записи
  query: string;                       // Поисковый запрос
  timestamp: Date;                     // Время запроса
  tagIds: string[];                    // ID меток из запроса
}

// История просмотра карточек
export interface ViewHistory {
  id: string;                          // Уникальный ID записи
  cardId: string;                      // ID просмотренной карточки
  timestamp: Date;                     // Время просмотра
}

// Состояние представления (вид галереи)
export type ViewMode = 'standard' | 'compact';

// Фильтр типа контента
export type ContentFilter = 'all' | 'images' | 'videos';

// Состояние фильтра
export interface FilterState {
  contentType: ContentFilter;          // Фильтр по типу
  tags: string[];                      // Выбранные метки
  searchQuery: string;                 // Поисковый запрос
}

// Превью изображения для кеширования
export interface ThumbnailCache {
  id: string;                          // ID кеша (обычно = cardId)
  cardId: string;                      // ID карточки
  standard: Blob;                      // Превью для стандартного вида
  compact: Blob;                       // Превью для компактного вида
  dateGenerated: Date;                 // Дата генерации
  expiresAt: Date;                     // Дата истечения (30 дней)
}

// Статистика использования
export interface AppStatistics {
  totalCards: number;                  // Общее количество карточек
  imageCount: number;                  // Количество изображений
  videoCount: number;                  // Количество видео
  totalSize: number;                   // Общий размер файлов (байты)
  collectionCount: number;             // Количество коллекций
  tagCount: number;                    // Количество меток
  categoryCount: number;               // Количество категорий
}

